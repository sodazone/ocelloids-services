import { Mutex } from 'async-mutex'
import { safeDestr } from 'destr'
import { Janitor, JanitorTask } from '@/services/scheduling/janitor.js'
import { jsonEncoded, Logger, SubLevel } from '@/services/types.js'
import { HOUR } from '../common/time.js'
import { AgentRuntimeContext } from '../types.js'
import {
  BasejumpExecuted,
  BasejumpInitiated,
  BasejumpLandedWithContext,
  BasejumpMessagePayload,
  BasejumpPending,
  BasejumpProcessed,
  BasejumpRelayedWithContext,
  BasejumpUnmatched,
  toMatchingKey,
} from './types.js'

const DEFAULT_TIMEOUT = 24 * HOUR

export const prefixes = {
  matching: {
    outbound: 'bj:ma:out',
    relay: 'bj:ma:relay',
    landed: 'bj:ma:in',
  },
}

export type MatchedReceiver = (payload: BasejumpMessagePayload) => Promise<void> | void

export class BasejumpMatchingEngine {
  readonly #id = 'basejump-matching'
  readonly #log: Logger
  readonly #janitor: Janitor

  readonly #outbound: SubLevel<BasejumpInitiated>
  readonly #inbound: SubLevel<BasejumpLandedWithContext>
  readonly #relay: SubLevel<BasejumpRelayedWithContext>

  readonly #mutex: Mutex
  readonly #matchedReceiver: MatchedReceiver
  readonly #expiry: number

  constructor({ log, db, janitor }: AgentRuntimeContext, matchedReceiver: MatchedReceiver) {
    this.#log = log
    this.#janitor = janitor
    this.#mutex = new Mutex()
    this.#matchedReceiver = matchedReceiver

    this.#outbound = db.sublevel<string, BasejumpInitiated>(prefixes.matching.outbound, jsonEncoded)
    this.#inbound = db.sublevel<string, BasejumpLandedWithContext>(prefixes.matching.landed, jsonEncoded)
    this.#relay = db.sublevel<string, BasejumpRelayedWithContext>(prefixes.matching.relay, jsonEncoded)

    this.#expiry = DEFAULT_TIMEOUT
    this.#janitor.on('sweep', this.#onSwept.bind(this))
  }

  async onOutboundMessage(msg: BasejumpInitiated) {
    await this.#mutex.runExclusive(async () => {
      const key = toMatchingKey(msg.to, msg.asset, msg.amount)
      const vaaId = msg.vaaId
      // check first if there is already an outbound msg stored with the same key
      if ((await this.#isOutboundDuplicate(key)) && vaaId && (await this.#isOutboundDuplicate(vaaId))) {
        return
      }

      this.#onBasejumpOutbound(key, msg)

      // If we have vaaId, try to match relay with that since it's unique
      const relayMsg = vaaId
        ? await Promise.any([this.#relay.get(key), this.#relay.get(vaaId)])
        : await this.#relay.get(key)
      if (relayMsg !== undefined) {
        const batch = this.#relay.batch().del(key)
        if (vaaId) {
          batch.del(vaaId)
        }
        await batch.write()

        // since the outbound amount is total - fee, we check again at relay that that amount for matching is still the same.
        // if differs, assume relay amount is more accurate since there's no fee deducted on this step
        const updatedKey = toMatchingKey(relayMsg.recipient, relayMsg.asset, relayMsg.amount)
        if (updatedKey !== key) {
          await Promise.all([
            this.#outbound.put(updatedKey, msg),
            this.#outbound.del(key),
            this.#scheduleSweep(updatedKey, prefixes.matching.outbound),
          ])
        }
        this.#onBasejumpRelayed(key, msg, relayMsg)
      }

      const inbound = await this.#inbound.get(key)
      if (inbound !== undefined) {
        await this.#handleMatched(key, msg, inbound, () => this.#inbound.del(key))
        if (inbound.type === 'executed' || inbound.type === 'fulfilled') {
          return
        }
      }

      this.#log.info(
        '[%s:%s] OUT STORED key=%s (block=%s #%s)',
        this.#id,
        msg.origin.chainId,
        key,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      const keys = [key]
      await this.#outbound.put(key, msg)
      if (vaaId) {
        await this.#outbound.put(vaaId, msg)
        keys.push(vaaId)
      }

      await this.#scheduleSweep(keys, prefixes.matching.outbound)
    })
  }

  async onRelayMessage(msg: BasejumpRelayedWithContext) {
    await this.#mutex.runExclusive(async () => {
      const key = toMatchingKey(msg.recipient, msg.asset, msg.amount)
      const outMsg = await Promise.any([this.#outbound.get(key), this.#outbound.get(msg.vaaId)])

      if (outMsg !== undefined) {
        this.#onBasejumpRelayed(key, outMsg, msg)
        return
      }

      this.#log.info(
        '[%s:%s] RELAY STORED key=%s vaa=%s (block=%s #%s)',
        this.#id,
        msg.chainId,
        key,
        msg.vaaId,
        msg.blockHash,
        msg.blockNumber,
      )

      await this.#relay.batch().put(key, msg).put(msg.vaaId, msg).write()
      await this.#scheduleSweep([key, msg.vaaId], prefixes.matching.relay)
    })
  }

  async onInboundMessage(msg: BasejumpLandedWithContext) {
    await this.#mutex.runExclusive(async () => {
      const key = toMatchingKey(msg.recipient, msg.asset, msg.amount)
      const promises = msg.vaaId
        ? [this.#outbound.get(key), this.#outbound.get(msg.vaaId)]
        : [this.#outbound.get(key)]
      const outMsg = await Promise.any(promises)

      if (outMsg) {
        if (msg.type === 'queued') {
          // do not clear outbound since we need it for fulfilment matching
          await this.#handleMatched(key, outMsg, msg, () => Promise.resolve())
          return
        }

        const clear = msg.vaaId
          ? () => this.#outbound.batch().del(key).del(msg.vaaId!).write()
          : () => this.#outbound.del(key)

        await this.#handleMatched(key, outMsg, msg, clear)
        return
      }

      if (msg.vaaId) {
        await this.#inbound.batch().put(key, msg).put(msg.vaaId, msg).write()
        await this.#scheduleSweep([key, msg.vaaId], prefixes.matching.landed)
      } else {
        await this.#inbound.put(key, msg)
        await this.#scheduleSweep(key, prefixes.matching.landed)
      }
    })
  }

  async #handleMatched(
    key: string,
    outMsg: BasejumpInitiated,
    inMsg: BasejumpLandedWithContext,
    cleanup: () => Promise<void>,
  ) {
    // defer clean up in case of race conditions in matching
    setTimeout(async () => {
      await cleanup()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
    }, 500).unref()
    this.#onBasejumpMatched(key, outMsg, inMsg)
  }

  #onBasejumpOutbound(key: string, outMsg: BasejumpInitiated) {
    try {
      this.#log.info(
        '[%s:%s] OUT key=%s vaa=%s (block=%s #%s)',
        this.#id,
        outMsg.origin.chainId,
        key,
        outMsg.vaaId,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber,
      )
      this.#matchedReceiver(outMsg)
    } catch (e) {
      this.#log.error(e, 'Error on outbound')
    }
  }

  #onBasejumpRelayed(key: string, originMsg: BasejumpInitiated, relayMsg: BasejumpRelayedWithContext) {
    try {
      const relayed = new BasejumpProcessed(originMsg, relayMsg)
      this.#log.info(
        '[%s:%s] RELAY key=%s vaa=%s (block=%s #%s)',
        this.#id,
        relayMsg.chainId,
        key,
        relayMsg.vaaId,
        relayMsg.blockHash,
        relayMsg.blockNumber,
      )

      this.#matchedReceiver(relayed)
    } catch (e) {
      this.#log.error(e, 'Error on relayed')
    }
  }

  #onBasejumpMatched(key: string, originMsg: BasejumpInitiated, inboundMsg: BasejumpLandedWithContext) {
    try {
      if (inboundMsg.type === 'executed') {
        const received = new BasejumpExecuted(originMsg, inboundMsg)
        this.#log.info(
          '[%s] EXECUTED source=%s dest=%s key=%s (block=%s #%s)',
          this.#id,
          received.origin.chainId,
          received.destination.chainId,
          key,
          inboundMsg.blockHash,
          inboundMsg.blockNumber,
        )
        this.#matchedReceiver(received)
      } else {
        const pending = new BasejumpPending(originMsg, inboundMsg)
        this.#log.info(
          '[%s] %s source=%s dest=%s key=%s (block=%s #%s)',
          this.#id,
          pending.type.toUpperCase(),
          pending.origin.chainId,
          pending.destination.chainId,
          key,
          inboundMsg.blockHash,
          inboundMsg.blockNumber,
        )
        this.#matchedReceiver(pending)
      }
    } catch (e) {
      this.#log.error(e, 'Error on matched')
    }
  }

  async #scheduleSweep(keys: string | string[], sublevel: string, expiry?: number) {
    const toSchedule = Array.isArray(keys) ? keys : [keys]
    await Promise.all(
      toSchedule.map(async (key) => {
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        const task: JanitorTask = {
          sublevel,
          key,
          expiry: expiry ?? this.#expiry,
        }
        await this.#janitor.schedule(task)
      }),
    )
  }

  async #isOutboundDuplicate(key: string) {
    const existing = await this.#outbound.get(key)
    if (existing !== undefined) {
      this.#log.info(
        '[%s:o] DUPLICATE outbound dropped hash=%s (block=%s #%s)',
        existing.origin.chainId,
        key,
        existing.origin.blockHash,
        existing.origin.blockNumber,
      )
      return true
    } else {
      return false
    }
  }

  #onSwept(task: JanitorTask, msg: string) {
    try {
      if (task.sublevel === prefixes.matching.outbound) {
        const outMsg = safeDestr<BasejumpInitiated>(msg)
        const message = new BasejumpUnmatched(outMsg)
        this.#log.debug('TIMEOUT on key %s', task.key)
        this.#matchedReceiver(message)
      }
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }
}

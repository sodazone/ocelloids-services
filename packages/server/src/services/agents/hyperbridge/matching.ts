import EventEmitter from 'node:events'
import { Mutex } from 'async-mutex'
import { safeDestr } from 'destr'
import { Janitor, JanitorTask } from '@/services/scheduling/janitor.js'
import { jsonEncoded, Logger, SubLevel } from '@/services/types.js'
import { AgentRuntimeContext } from '../types.js'
import { TelemetryHyperbridgeEventEmitter } from './telemetry/events.js'
import {
  HyperbridgeDispatched,
  HyperbridgeMessagePayload,
  HyperbridgeReceived,
  HyperbridgeRelayed,
  HyperbridgeTimeout,
  HyperbridgeUnmatched,
  IsmpPostRequestHandledWithContext,
  IsmpPostRequestWithContext,
  isIsmpPostRequestHandledWithContext,
} from './types.js'

const HOUR = 60 * 60_000
const DEFAULT_TIMEOUT = 24 * HOUR

export const prefixes = {
  matching: {
    outbound: 'ismp:ma:out',
    inbound: 'ismp:ma:in',
    relayOut: 'ismp:ma:relay:out',
    relayIn: 'ismp:ma:relay:in',
    retry: 'ismp:ma:retry',
  },
}

export type MatchedReceiver = (payload: HyperbridgeMessagePayload) => Promise<void> | void

export class HyperbridgeMatchingEngine extends (EventEmitter as new () => TelemetryHyperbridgeEventEmitter) {
  readonly #id = 'hyperbridge-matching'
  readonly #log: Logger
  readonly #janitor: Janitor

  readonly #outbound: SubLevel<HyperbridgeDispatched>
  readonly #inbound: SubLevel<IsmpPostRequestHandledWithContext>
  readonly #relayIn: SubLevel<IsmpPostRequestHandledWithContext>
  readonly #relayOut: SubLevel<IsmpPostRequestWithContext>
  readonly #retry: SubLevel<HyperbridgeDispatched>

  readonly #mutex: Mutex
  readonly #matchedReceiver: MatchedReceiver
  readonly #expiry: number

  constructor({ log, db, janitor }: AgentRuntimeContext, matchedReceiver: MatchedReceiver) {
    super()

    this.#log = log
    this.#janitor = janitor
    this.#mutex = new Mutex()
    this.#matchedReceiver = matchedReceiver

    // Uses commitment hash as key since is guaranteed to be unique
    this.#outbound = db.sublevel<string, HyperbridgeDispatched>(prefixes.matching.outbound, jsonEncoded)
    this.#inbound = db.sublevel<string, IsmpPostRequestHandledWithContext>(
      prefixes.matching.inbound,
      jsonEncoded,
    )
    this.#relayOut = db.sublevel<string, IsmpPostRequestWithContext>(prefixes.matching.relayOut, jsonEncoded)
    this.#relayIn = db.sublevel<string, IsmpPostRequestHandledWithContext>(
      prefixes.matching.relayIn,
      jsonEncoded,
    )
    // For storing dispatched messages that have failed on destination,
    // since relayers can retry the message and succeed later.
    // We keep message in retry instead of outbound to avoid triggering timeout unmatched if the failed outcome is in fact the final outcome
    this.#retry = db.sublevel<string, HyperbridgeDispatched>(prefixes.matching.retry, jsonEncoded)

    this.#expiry = DEFAULT_TIMEOUT
    this.#janitor.on('sweep', this.#onSwept.bind(this))
  }

  async onOutboundMessage(msg: HyperbridgeDispatched) {
    await this.#mutex.runExclusive(async () => {
      const key = msg.commitment
      // check first if there is already an outbound msg stored with the same key
      if (await this.#isOutboundDuplicate(key)) {
        return
      }

      this.#onIsmpOutbound(msg)

      const relayInMsg = await this.#relayIn.get(key)
      if (relayInMsg !== undefined) {
        await this.#relayIn.del(key)
        this.#onIsmpRelayed(msg, relayInMsg)
      }
      const relayOutMsg = await this.#relayOut.get(key)
      if (relayOutMsg !== undefined) {
        await this.#relayOut.del(key)
        this.#onIsmpRelayed(msg, relayOutMsg)
      }

      const inboundMsg = await this.#inbound.get(key)
      if (inboundMsg !== undefined) {
        if (inboundMsg.outcome === 'Fail') {
          await this.#storeRetry(msg)
        }
        await this.#handleMatched(msg, inboundMsg, () => this.#inbound.del(key))
      } else {
        this.#log.info(
          '[%s:%s] OUT STORED key=%s (block=%s #%s)',
          this.#id,
          msg.origin.chainId,
          key,
          msg.origin.blockHash,
          msg.origin.blockNumber,
        )
        await this.#outbound.put(key, msg)
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        const task: JanitorTask = {
          sublevel: prefixes.matching.outbound,
          key,
          expiry: this.#expiry,
        }
        await this.#janitor.schedule(task)
      }
    })
  }

  async onInboundMessage(msg: IsmpPostRequestHandledWithContext) {
    await this.#mutex.runExclusive(async () => {
      const key = msg.commitment

      const retryMsg = await this.#retry.get(key)
      if (retryMsg !== undefined) {
        this.#onIsmpMatched(retryMsg, msg)
        return
      }
      const outboundMsg = await this.#outbound.get(key)
      if (outboundMsg !== undefined) {
        if (msg.outcome === 'Fail') {
          await this.#storeRetry(outboundMsg)
        }
        await this.#handleMatched(outboundMsg, msg, () => this.#outbound.del(key))
      } else {
        this.#log.info(
          '[%s:%s] IN STORED key=%s (block=%s #%s)',
          this.#id,
          msg.chainId,
          key,
          msg.blockHash,
          msg.blockNumber,
        )
        await this.#inbound.put(key, msg)
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        const task: JanitorTask = {
          sublevel: prefixes.matching.inbound,
          key,
          expiry: this.#expiry,
        }
        await this.#janitor.schedule(task)
      }
    })
  }

  async onRelayMessage(msg: IsmpPostRequestWithContext | IsmpPostRequestHandledWithContext) {
    await this.#mutex.runExclusive(async () => {
      const key = msg.commitment
      const outboundMsg = await this.#outbound.get(key)

      if (outboundMsg !== undefined) {
        this.#onIsmpRelayed(outboundMsg, msg)
        return
      }

      const isRelayIn = isIsmpPostRequestHandledWithContext(msg)
      const sublevel = isRelayIn ? prefixes.matching.relayIn : prefixes.matching.relayOut
      const storeMsg = isRelayIn ? () => this.#relayIn.put(key, msg) : () => this.#relayOut.put(key, msg)

      this.#log.info(
        '[%s:%s] RELAY %s STORED key=%s (block=%s #%s)',
        this.#id,
        msg.chainId,
        isRelayIn ? 'IN' : 'OUT',
        key,
        msg.blockHash,
        msg.blockNumber,
      )

      await storeMsg()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      const task: JanitorTask = {
        sublevel,
        key,
        expiry: this.#expiry,
      }
      await this.#janitor.schedule(task)
    })
  }

  async #storeRetry(outboundMsg: HyperbridgeDispatched) {
    const key = outboundMsg.commitment

    this.#log.info(
      '[%s:%s] RETRY STORED key=%s (block=%s #%s)',
      this.#id,
      outboundMsg.origin.chainId,
      key,
      outboundMsg.origin.blockHash,
      outboundMsg.origin.blockNumber,
    )
    await this.#retry.put(key, outboundMsg)
    await new Promise((res) => setImmediate(res))

    const expiry = outboundMsg.timeoutAt > Date.now() ? outboundMsg.timeoutAt - Date.now() + 3 * HOUR : null
    const task: JanitorTask = {
      sublevel: prefixes.matching.retry,
      key,
      expiry: expiry ?? this.#expiry,
    }
    await this.#janitor.schedule(task)
  }

  async #handleMatched(
    outMsg: HyperbridgeDispatched,
    inMsg: IsmpPostRequestHandledWithContext,
    cleanup: () => Promise<void>,
  ) {
    // defer clean up in case of race conditions in matching
    setTimeout(async () => {
      await cleanup()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
    }, 1_000).unref()
    this.#onIsmpMatched(outMsg, inMsg)
  }

  #onIsmpOutbound(outMsg: HyperbridgeDispatched) {
    try {
      this.#log.info(
        '[%s:%s] OUT key=%s (block=%s #%s)',
        this.#id,
        outMsg.origin.chainId,
        outMsg.commitment,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber,
      )
      this.emit('telemetryIsmpOutbound', outMsg)
      this.#matchedReceiver(outMsg)
    } catch (e) {
      this.#log.error(e, 'Error on outbound')
    }
  }

  #onIsmpRelayed(
    originMsg: HyperbridgeDispatched,
    relayMsg: IsmpPostRequestWithContext | IsmpPostRequestHandledWithContext,
  ) {
    try {
      const relayed = new HyperbridgeRelayed(originMsg, relayMsg)
      this.#log.info(
        '[%s:%s] RELAY direction=%s key=%s (block=%s #%s)',
        this.#id,
        relayMsg.chainId,
        relayed.direction,
        relayMsg.commitment,
        relayMsg.blockHash,
        relayMsg.blockNumber,
      )

      this.emit('telemetryIsmpRelayed', relayed)
      this.#matchedReceiver(relayed)
    } catch (e) {
      this.#log.error(e, 'Error on relayed')
    }
  }

  #onIsmpMatched(originMsg: HyperbridgeDispatched, inboundMsg: IsmpPostRequestHandledWithContext) {
    try {
      if (inboundMsg.type === 'Received') {
        const received = new HyperbridgeReceived(originMsg, inboundMsg)
        this.#log.info(
          '[%s] RECEIVED source=%s dest=%s key=%s tx=%s',
          this.#id,
          received.origin.chainId,
          received.destination.chainId,
          received.commitment,
          received.waypoint.txPosition ?? 'n/a',
        )
        this.emit('telemetryIsmpReceived', received)
        this.#matchedReceiver(received)
      } else {
        const timeout = new HyperbridgeTimeout(originMsg, inboundMsg)
        this.#log.info(
          '[%s] TIMEOUT source=%s dest=%s key=%s',
          this.#id,
          timeout.origin.chainId,
          timeout.destination.chainId,
          timeout.commitment,
        )
        this.emit('telemetryIsmpTimeout', timeout)
        this.#matchedReceiver(timeout)
      }
    } catch (e) {
      this.#log.error(e, 'Error on matched')
    }
  }

  async #isOutboundDuplicate(key: string) {
    const existing = await this.#outbound.get(key)
    if (existing !== undefined) {
      this.#log.debug(
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
        const outMsg = safeDestr<HyperbridgeDispatched>(msg)
        const message = new HyperbridgeUnmatched(outMsg)
        this.#log.debug('TIMEOUT on key %s', task.key)
        this.emit('telemetryHyperbridgeUnmatched', message)
        this.#matchedReceiver(message)
      }
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }
}

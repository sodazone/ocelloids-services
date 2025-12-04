import { z } from 'zod'

import { asSerializable } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { HexString } from '@/lib.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block, Event } from '@/services/networking/substrate/types.js'
import { RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { matchExtrinsic } from '../xcm/ops/util.js'
import { createGovDataFetcher, GovDataFetcher } from './content.js'
import { humanizeReferendumStatus } from './humanize.js'
import { OpenGovApi, OpenGovEvent, withOpenGov } from './substrate.js'

type SetValidationDataArgs = {
  data: {
    validation_data: {
      relay_parent_number: number
    }
  }
}

export const $OpenGovInputs = z.object({
  networks: z.array(
    z.string({ required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"' }).min(1),
  ),
})

export type OpenGovInputs = z.infer<typeof $OpenGovInputs>
type OpenGovHandler = {
  subscription: Subscription<OpenGovInputs>
  streams: RxSubscriptionWithId[]
}

function tracksRelayBlockSource(chainId: NetworkURN): boolean {
  return ['polkadot', 'kusama', 'paseo'].includes(getConsensus(chainId)) && getChainId(chainId) === '1000'
}

function getRelayHeight(block: Block) {
  const ext = block.extrinsics.find((tx) => matchExtrinsic(tx, 'ParachainSystem', 'set_validation_data'))
  return ext ? (ext.args as SetValidationDataArgs).data.validation_data.relay_parent_number : null
}

/**
 * OpenGov Agent
 *
 * Listens to finalized blocks, extracts OpenGov referenda events, and tracks
 * their lifecycle, including Scheduler execution correlation.
 */
export class OpenGovAgent implements Agent, Subscribable {
  readonly id = 'opengov'
  readonly metadata: AgentMetadata = {
    name: this.id,
    capabilities: getAgentCapabilities(this),
  }
  readonly inputSchema = $OpenGovInputs

  readonly #handlers: Record<string, OpenGovHandler> = {}
  readonly #shared: SubstrateSharedStreams
  readonly #log: Logger
  readonly #egress: Egress
  readonly #ingress: SubstrateIngressConsumer
  readonly #db: LevelDB
  readonly #content: GovDataFetcher

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = ctx.ingress.substrate
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#egress = ctx.egress
    this.#db = ctx.openLevelDB('opengov', { valueEncoding: 'json' })
    this.#content = createGovDataFetcher()
  }

  subscribe(subscription: Subscription<OpenGovInputs>) {
    if (subscription.ephemeral) {
      throw new ValidationError('Ephemeral subscriptions are not supported')
    }

    const {
      id,
      args: { networks },
    } = subscription

    // Validate all networks
    for (const network of networks) {
      this.#shared.checkSupportedNetwork(network as NetworkURN)
    }

    const streams: RxSubscriptionWithId[] = []

    this.#handlers[id] = { subscription, streams }
    ;(async () => {
      try {
        // Subscribe to all networks
        const tasks = networks.map(async (network) => {
          const chainId = network as NetworkURN
          const openGovApi = await withOpenGov(chainId, this.#ingress)

          const sub = this.#shared.blocks(chainId, 'finalized').subscribe({
            next: async (block) => {
              try {
                await this.#processDispatchedEvents(chainId, block, subscription)
                await this.#processReferendaEvents(chainId, block, openGovApi, subscription)
              } catch (err) {
                this.#log.error(err, '[%s:%s] error processing block %d', this.id, chainId, block.number)
              }
            },
            error: (err: any) => {
              this.#log.error(err, '[%s:%s] stream error on subscription %s', this.id, chainId, id)
            },
          })

          return { id, sub } as RxSubscriptionWithId
        })

        const results = await Promise.all(tasks)
        streams.push(...results)
      } catch (err) {
        // Clean up any streams that were created before failure
        for (const { sub } of streams) {
          sub.unsubscribe()
        }
        this.#log.error(err, '[agent:%s] failed to initialize OpenGov subscription %s', this.id, id)
      }
    })()
  }

  unsubscribe(subscriptionId: string) {
    const handler = this.#handlers[subscriptionId]
    if (!handler) {
      return
    }
    for (const { sub } of handler.streams) {
      sub.unsubscribe()
    }
    delete this.#handlers[subscriptionId]
  }

  update(): Subscription {
    throw new Error('Update is not supported')
  }

  stop() {
    for (const handler of Object.values(this.#handlers)) {
      this.#log.info('[agent:%s] unsubscribe %s', this.id, handler.subscription.id)
      handler.streams.forEach(({ sub }) => sub.unsubscribe())
    }
  }

  collectTelemetry() {
    // placeholder for metrics
  }

  async start(subscriptions: Subscription<OpenGovInputs>[] = []) {
    this.#log.info('[%s] start (%s)', this.id, subscriptions.length)
    for (const subscription of subscriptions) {
      this.subscribe(subscription)
    }
  }

  /** Handle Scheduler.Dispatched events and resolve pending tasks */
  async #processDispatchedEvents(
    chainId: NetworkURN,
    block: Block,
    subscription: Subscription<OpenGovInputs>,
  ) {
    const dispatchEvents = block.events.filter(
      ({ event }) => event.module === 'Scheduler' && event.name === 'Dispatched',
    )

    for (const dispatched of dispatchEvents) {
      const height = Number(dispatched.event.value?.task[0])
      const pendings: any[] = (await this.#db.get(`${chainId}:pending:${height}`)) ?? []

      if (pendings.length === 0) {
        continue
      }

      const taskId = Number(dispatched.event.value?.task[1])
      const taskIndex = pendings.findIndex((p) => p.taskId === taskId)

      if (taskIndex >= 0) {
        const task = pendings[taskIndex]
        pendings.splice(taskIndex, 1)

        // Store execution result
        await this.#db.put(`${chainId}:exec:${block.number}:${task.referendumId}`, {
          ...task,
          executedAt: block.number,
          result: dispatched.event.value?.result,
        })

        const ref = (await this.#getReferendum(chainId, task.referendumId)) ?? {}
        const execution = {
          ...task,
          executedAt: block.number,
          result: dispatched.event.value?.result,
        }
        const refWithResult = {
          ...ref,
          execution,
        }
        const payload = asSerializable({
          ...refWithResult,
          humanized: {
            status: humanizeReferendumStatus(refWithResult),
          },
          content: await this.#content.fetchDescription(chainId, task.referendumId),
        }) as AnyJson

        this.#egress.publish(subscription, {
          metadata: {
            type: 'referendum.update',
            agentId: this.id,
            networkId: chainId,
            subscriptionId: subscription.id,
            timestamp: Date.now(),
          },
          payload,
        })
      }

      if (pendings.length > 0) {
        await this.#db.put(`${chainId}:pending:${height}`, pendings)
      } else {
        await this.#db.del(`${chainId}:pending:${height}`)
      }
    }
  }

  /** Handle referenda events in a block */
  async #processReferendaEvents(
    chainId: NetworkURN,
    block: Block,
    openGovApi: OpenGovApi,
    subscription: Subscription<OpenGovInputs>,
  ) {
    const referendaEvents = block.events
      .filter(({ event }) => event.module === 'Referenda')
      .map(({ event }) => event)

    for (const ev of referendaEvents) {
      let relayBlockNumber: number | null = null

      if (tracksRelayBlockSource(chainId)) {
        relayBlockNumber = getRelayHeight(block)
      }

      const ogev = await openGovApi.asOpenGovEvent({
        event: ev,
        block: { number: block.number, hash: block.hash as HexString, relayBlockNumber },
      })

      if (!ogev) {
        this.#log.warn(
          '[%s:%s] Skipping invalid event %s.%s #%d',
          this.id,
          chainId,
          ev.module,
          ev.name,
          block.number,
        )
        continue
      }

      // Get persisted copy if exists
      const existing = await this.#getReferendum(chainId, ogev.id)
      const next: OpenGovEvent = existing
        ? ogev.status === 'Killed' || Array.isArray(ogev.info)
          ? { ...existing, triggeredBy: ogev.triggeredBy, status: ogev.status }
          : { ...existing, ...ogev, triggeredBy: ogev.triggeredBy, status: ogev.status }
        : { ...ogev }

      // Persist updated record
      await this.#updateReferendum(chainId, next)

      // Handle lifecycle transitions
      switch (next.status) {
        case 'Approved':
          await this.#trackConfirmedReferendum(chainId, block, ev, next)
          break
        case 'Rejected':
        case 'Cancelled':
        case 'TimedOut':
        case 'Killed':
          // TODO: Schedule removal?
          // some update on the persisted referendum
          // await this.#removeReferendum(chainId, next.id)
          break
      }

      // Emit outbound event
      const ref = await this.#getReferendum(chainId, next.id)
      let payload: any = null

      if (ref) {
        const desc = await this.#content.fetchDescription(chainId, String(next.id))
        payload = {
          ...ref,
          content: desc,
          humanized: {
            status: humanizeReferendumStatus(ref),
          },
        }
      }

      if (payload) {
        this.#egress.publish(subscription, {
          metadata: {
            type: 'referendum.update',
            agentId: this.id,
            networkId: chainId,
            subscriptionId: subscription.id,
            timestamp: Date.now(),
          },
          payload,
        })
      }
    }
  }

  /** Track a confirmed referendum, storing pending task info for Scheduler execution */
  async #trackConfirmedReferendum(chainId: NetworkURN, block: Block, ev: Event, ref: OpenGovEvent) {
    if (Array.isArray(ref.info)) {
      if (ref.timeline?.willExecuteAt === undefined) {
        try {
          // here we don't have enough information to track the referendum
          // e.g. if we get directly the "Confirmed" event without seeing the "ConfirmationStarted"
          // so we fetch the details from an indexer to get the enactment data
          const details = (await this.#content.fetchDetails(chainId, ref.id)) as any
          const enactment = details?.onchainData?.enactment
          if (enactment) {
            const { when, index } = enactment
            const pendingKey = `${chainId}:pending:${when}`
            const pendings = (await this.#db.get(pendingKey)) ?? []

            if (
              pendings.findIndex(
                (pending: { referendumId: string }) => String(pending.referendumId) === String(ref.id),
              ) > -1
            ) {
              this.#log.warn(
                '[%s:%s] Referendum %d already pending on fallback fetch',
                this.id,
                chainId,
                ref.id,
              )
              return
            }

            pendings.push({
              referendumId: ref.id,
              taskId: index,
              scheduledAt: Date.now(),
              trackedAt: Date.now(),
              proposal: { type: 'Decoded', value: asSerializable(details?.onchainData?.proposal) },
            })

            await this.#db.put(pendingKey, pendings)

            // Persist updated ref with scheduling metadata
            const updated = { ...ref, scheduled: { when, index } }
            await this.#updateReferendum(chainId, updated)
          }
        } catch (error) {
          this.#log.error('[%s:%s] Failed to track confirmed referendum %d', this.id, chainId, ref.id, error)
        }
      }
      return
    }

    const confirmedIdx = block.events.findIndex(
      ({ event: e }) =>
        e.module === ev.module && e.name === ev.name && (e.value as any)?.index === (ev.value as any)?.index,
    )

    const taskEvent = block.events
      .slice(0, confirmedIdx)
      .findLast(({ event: e }) => e.module === 'Scheduler' && e.name === 'Scheduled')

    if (!taskEvent) {
      this.#log.warn(
        '[%s:%s] Referendum %d confirmed but no Scheduler.Scheduled found',
        this.id,
        chainId,
        ref.id,
      )
      return
    }

    const scheduled = taskEvent.event.value
    const taskId = Number(scheduled.index)

    const pendingKey = `${chainId}:pending:${scheduled.when}`
    const pendings = (await this.#db.get(pendingKey)) ?? []

    pendings.push({
      referendumId: ref.id,
      taskId,
      scheduledAt: Date.now(),
      trackedAt: Date.now(),
      proposal: ref.info?.proposal,
    })

    await this.#db.put(pendingKey, pendings)

    // Persist updated ref with scheduling metadata
    const updated = { ...ref, scheduled: { when: scheduled.when, index: taskId } }
    await this.#updateReferendum(chainId, updated)

    this.#log.debug(
      '[%s:%s] Tracked referendum %d scheduled task %d at block %d',
      this.id,
      chainId,
      ref.id,
      taskId,
      scheduled.when,
    )

    return updated
  }

  /** Insert or replace a referendum record */
  async #updateReferendum(chainId: NetworkURN, ref: OpenGovEvent) {
    await this.#db.put(`${chainId}:ref:${ref.id}`, asSerializable(ref))
    this.#log.debug('[%s:%s] Updated referendum %d (%s)', this.id, chainId, ref.id, ref.status)
  }

  /** Fetch referendum by ID */
  async #getReferendum(chainId: NetworkURN, id: number) {
    try {
      return (await this.#db.get(`${chainId}:ref:${id}`)) as OpenGovEvent | undefined
    } catch {
      return undefined
    }
  }

  /** Delete referendum record */
  // async #removeReferendum(chainId: NetworkURN, id: number) {
  //   await this.#db.del(`${chainId}:ref:${id}`)
  //   this.#log.debug('[%s:%s] Removed referendum %d', this.id, chainId, id)
  // }
}

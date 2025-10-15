import { z } from 'zod'

import { asSerializable } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { HexString } from '@/lib.js'
import { Egress } from '@/services/egress/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block, Event } from '@/services/networking/substrate/types.js'
import { Subscription as OcSubscription, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { AnyJson, LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { Agent, AgentMetadata, AgentRuntimeContext, Subscribable, getAgentCapabilities } from '../types.js'
import { OpenGovApi, OpenGovEvent, withOpenGov } from './substrate.js'

export const $OpenGovInputs = z.object({
  networks: z.array(
    z.string({ required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"' }).min(1),
  ),
})

export type OpenGovInputs = z.infer<typeof $OpenGovInputs>

/**
 * OpenGov Agent
 *
 * Listens to finalized blocks, extracts OpenGov referenda events, and tracks
 * their lifecycle, including Scheduler execution correlation.
 */
export class OpenGov implements Agent, Subscribable {
  readonly id = 'opengov'
  readonly metadata: AgentMetadata = {
    name: this.id,
    capabilities: getAgentCapabilities(this),
  }
  readonly inputSchema = $OpenGovInputs

  readonly #handlers: Record<
    string,
    { subscription: OcSubscription<OpenGovInputs>; streams: RxSubscriptionWithId[] }
  > = {}
  readonly #shared: SubstrateSharedStreams
  readonly #log: Logger
  readonly #egress: Egress
  readonly #ingress: SubstrateIngressConsumer
  readonly #db: LevelDB

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = ctx.ingress.substrate
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#egress = ctx.egress
    this.#db = ctx.openLevelDB('opengov', { valueEncoding: 'json' })
  }

  subscribe(subscription: OcSubscription<OpenGovInputs>) {
    if (subscription.ephemeral) {
      throw new ValidationError('Ephemeral subscriptions are not supported')
    }

    const {
      id,
      args: { networks },
    } = subscription
    const streams: RxSubscriptionWithId[] = []
    this.#handlers[id] = { subscription, streams }

    this.#initializeSubscription(id, networks, streams).catch((err) => {
      streams.forEach(({ sub }) => sub.unsubscribe())
      this.#log.error(err, '[agent:%s] failed to initialize OpenGov subscription %s', this.id, id)
    })
  }

  unsubscribe(subscriptionId: string) {
    const handler = this.#handlers[subscriptionId]
    if (!handler) {
      return
    }
    handler.streams.forEach(({ sub }) => sub.unsubscribe())
    delete this.#handlers[subscriptionId]
  }

  update(): OcSubscription {
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

  start() {
    this.#log.info('[%s] start', this.id)
  }

  async #initializeSubscription(id: string, networks: string[], streams: RxSubscriptionWithId[]) {
    for (const network of networks) {
      const chainId = network as NetworkURN
      this.#shared.checkSupportedNetwork(chainId)
      const openGovApi = await withOpenGov(chainId, this.#ingress)

      const stream = this.#shared.blocks(chainId, 'finalized').subscribe({
        next: async (block) => {
          try {
            await this.#processDispatchedEvents(chainId, block, this.#handlers[id].subscription)
            await this.#processReferendaEvents(chainId, block, openGovApi, this.#handlers[id].subscription)
          } catch (err) {
            this.#log.error(err, '[%s:%s] error processing block %d', this.id, chainId, block.number)
          }
        },
        error: (err: any) => {
          this.#log.error(err, '[%s:%s] stream error on subscription %s', this.id, chainId, id)
        },
      })

      streams.push({ chainId, sub: stream } as RxSubscriptionWithId)
    }
  }

  /** Handle Scheduler.Dispatched events and resolve pending tasks */
  async #processDispatchedEvents(
    chainId: NetworkURN,
    block: Block,
    subscription: OcSubscription<OpenGovInputs>,
  ) {
    const pendings: any[] = (await this.#db.get(`${chainId}:pending:${block.number}`)) ?? []

    const dispatchEvents = block.events.filter(
      ({ event }) => event.module === 'Scheduler' && event.name === 'Dispatched',
    )

    for (const dispatched of dispatchEvents) {
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

        this.#egress.publish(
          subscription,
          asSerializable({
            ...task,
            executedAt: block.number,
            result: dispatched.event.value?.result,
          }),
        )
      }
    }

    if (pendings.length > 0) {
      await this.#db.put(`${chainId}:pending:${block.number}`, pendings)
    } else {
      await this.#db.del(`${chainId}:pending:${block.number}`)
    }
  }

  /** Handle referenda events in a block */
  async #processReferendaEvents(
    chainId: NetworkURN,
    block: Block,
    openGovApi: OpenGovApi,
    subscription: OcSubscription<OpenGovInputs>,
  ) {
    const referendaEvents = block.events
      .filter(({ event }) => event.module === 'Referenda')
      .map(({ event }) => event)

    for (const ev of referendaEvents) {
      const ogev = await openGovApi.asOpenGovEvent({
        event: ev,
        block: { number: block.number, hash: block.hash as HexString },
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
        ? Array.isArray(ogev.info)
          ? { ...existing, triggeredBy: ogev.triggeredBy, type: ogev.type }
          : { ...existing, ...ogev, triggeredBy: ogev.triggeredBy, type: ogev.type }
        : { ...ogev }

      // Persist updated record
      await this.#updateReferendum(chainId, next)

      // Handle lifecycle transitions
      switch (next.type) {
        case 'Approved':
          await this.#trackConfirmedReferendum(chainId, block, ev, next)
          break
        case 'Rejected':
        case 'Cancelled':
        case 'TimedOut':
        case 'Killed':
          await this.#removeReferendum(chainId, next.id)
          break
      }

      // Emit outbound event
      const payload = (await this.#getReferendum(chainId, next.id)) as AnyJson
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
      return
    }

    const executeAt = ref.timeline?.willExecuteAt
    if (!executeAt) {
      this.#log.warn('[%s:%s] Referendum %d confirmed but missing willExecuteAt', this.id, chainId, ref.id)
      return
    }

    const confirmedIdx = block.events.findIndex(
      ({ event: e }) =>
        e.module === ev.module && e.name === ev.name && (e.value as any)?.index === (ev.value as any)?.index,
    )

    const taskEvent = block.events
      .slice(0, confirmedIdx)
      .find(
        ({ event: e }) => e.module === 'Scheduler' && e.name === 'Scheduled' && e.value?.when === executeAt,
      )

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

    const pendingKey = `${chainId}:pending:${executeAt}`
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
      executeAt,
    )

    return updated
  }

  /** Insert or replace a referendum record */
  async #updateReferendum(chainId: NetworkURN, ref: OpenGovEvent) {
    await this.#db.put(`${chainId}:ref:${ref.id}`, asSerializable(ref))
    this.#log.debug('[%s:%s] Updated referendum %d (%s)', this.id, chainId, ref.id, ref.type)
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
  async #removeReferendum(chainId: NetworkURN, id: number) {
    await this.#db.del(`${chainId}:ref:${id}`)
    this.#log.debug('[%s:%s] Removed referendum %d', this.id, chainId, id)
  }
}

import { Operation } from 'rfc6902'
import { filter, mergeMap } from 'rxjs'

import { ControlQuery, asPublicKey, asSerializable } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { Egress } from '@/services/egress/hub.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'

import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  ServerSideEvent,
  ServerSideEventsBroadcaster,
  ServerSideEventsRequest,
  Streamable,
  Subscribable,
  getAgentCapabilities,
} from '../types.js'

import { AccountWithCaps } from '@/services/accounts/types.js'
import { asDateRange } from '@/services/archive/time.js'
import { CAP_WRITE } from '@/services/auth/caps.js'
import { createServerSideEventsBroadcaster } from '../api/sse.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { XcmAnalytics } from './analytics/index.js'
import { XcmExplorer } from './explorer/index.js'
import { FullXcmJourneyResponse } from './explorer/repositories/types.js'
import { XcmSubscriptionManager } from './handlers.js'
import { XcmHumanizer } from './humanize/index.js'
import {
  matchMessage,
  matchNotificationType,
  matchSenders,
  messageCriteria,
  notificationTypeCriteria,
  sendersCriteria,
} from './ops/criteria.js'
import { XcmTracker } from './tracking.js'
import {
  $XcmInputs,
  HumanizedXcmPayload,
  XcmInputs,
  XcmMessagePayload,
  XcmSubscriptionHandler,
} from './types/index.js'
import { $XcmQueryArgs, XcmQueryArgs } from './types/index.js'
import { $XcmServerSideEventArgs, XcmServerSideEventArgs } from './types/sse.js'

export const XCM_AGENT_ID = 'xcm'

function applySseFilters(
  filters: XcmServerSideEventArgs,
  { data: journey }: ServerSideEvent<FullXcmJourneyResponse>,
): boolean {
  if (filters.id && filters.id !== journey.correlationId) {
    return false
  }
  if (
    filters.txHash &&
    filters.txHash !== journey.originExtrinsicHash &&
    filters.txHash !== journey.originEvmTxHash
  ) {
    return false
  }
  if (filters.address) {
    const pubKeyOrEvmAddress = asPublicKey(filters.address)
    if (pubKeyOrEvmAddress !== journey.from && pubKeyOrEvmAddress !== journey.to) {
      return false
    }
  }
  if (filters.origins && !filters.origins.includes(journey.origin)) {
    return false
  }
  if (filters.destinations && !filters.destinations.includes(journey.destination)) {
    return false
  }
  if (filters.usdAmountGte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountGte as unknown as string)
      if (journey.totalUsd < parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.usdAmountLte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountLte as unknown as string)
      if (journey.totalUsd > parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.assets) {
    const journeySymbols = journey.assets.map((a) => a.asset.toLowerCase())
    const hasAsset = filters.assets.some((a) => journeySymbols.includes(a.toLowerCase()))
    if (!hasAsset) {
      return false
    }
  }
  if (filters.actions && !filters.actions.includes(journey.type)) {
    return false
  }
  if (filters.status !== undefined) {
    const toCheck = Array.isArray(filters.status) ? filters.status : [filters.status]
    if (!toCheck.map((s) => s as typeof journey.status).includes(journey.status)) {
      return false
    }
  }

  return true
}

/**
 * The XCM monitoring agent.
 *
 * Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
 */
export class XcmAgent implements Agent, Subscribable, Queryable, Streamable {
  id = XCM_AGENT_ID

  querySchema = $XcmQueryArgs
  inputSchema = $XcmInputs
  streamFilterSchema = $XcmServerSideEventArgs

  metadata: AgentMetadata = {
    name: 'XCM Agent',
    description: `
      Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
      Currently supports XCMP-lite (HRMP) and VMP.
      `,
    capabilities: getAgentCapabilities(this),
  }

  readonly #log: Logger

  readonly #ingress: SubstrateIngressConsumer
  readonly #notifier: Egress

  readonly #subs: XcmSubscriptionManager
  readonly #tracker: XcmTracker
  readonly #humanizer: XcmHumanizer
  readonly #explorer: XcmExplorer
  readonly #sseBroadcaster: ServerSideEventsBroadcaster

  #analytics?: XcmAnalytics

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    this.#log = ctx.log

    this.#ingress = ctx.ingress.substrate
    this.#notifier = ctx.egress

    this.#subs = new XcmSubscriptionManager(ctx.log, ctx.ingress, this)
    this.#tracker = new XcmTracker(ctx)
    this.#humanizer = new XcmHumanizer({
      log: ctx.log,
      ingress: this.#ingress,
      deps,
    })

    try {
      if (ctx.analyticsDB !== undefined) {
        this.#analytics = new XcmAnalytics({
          log: ctx.log,
          db: ctx.analyticsDB,
          humanizer: this.#humanizer,
        })
      }
    } catch (error: unknown) {
      this.#log.error(error, '[agent:%s] could not start analytics', this.id)
    }

    this.#sseBroadcaster = createServerSideEventsBroadcaster<XcmServerSideEventArgs>(applySseFilters)
    this.#explorer = new XcmExplorer({
      log: ctx.log,
      dataPath: ctx.environment?.dataPath,
      humanizer: this.#humanizer,
      broadcaster: this.#sseBroadcaster,
    })
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    return this.#subs.update(subscriptionId, patch)
  }

  subscribe(subscription: Subscription<XcmInputs>, account?: AccountWithCaps): void {
    const { id, args } = subscription

    this.#validateAllowances(subscription, account)
    this.#validateHistorical(subscription)
    this.#validateChainIds(args)
    this.#validateSenders(args)

    const handler = this.#monitor(subscription)
    this.#subs.set(id, handler)
  }

  async unsubscribe(id: string): Promise<void> {
    if (!this.#subs.has(id)) {
      this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
      return
    }

    try {
      this.#subs.delete(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  async start(subs: Subscription<XcmInputs>[] = []) {
    this.#log.info('[agent:%s] wait APIs ready', this.id)

    await this.#ingress.isReady()

    this.#log.info('[agent:%s] APIs ready', this.id)

    this.#tracker.start()

    this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

    for (const sub of subs) {
      try {
        this.#subs.set(sub.id, this.#monitor(sub))
      } catch (error) {
        this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
      }
    }

    await this.#humanizer.start()
    await this.#analytics?.start(this.#tracker)
    await this.#explorer.start(this.#tracker)
  }

  async stop(): Promise<void> {
    this.#sseBroadcaster.close()
    this.#subs.stop()

    await this.#tracker.stop()
    await this.#explorer.stop()

    this.#analytics?.stop()
  }

  getSubscriptionHandler(subscriptionId: string): XcmSubscriptionHandler {
    return this.#subs.get(subscriptionId)
  }

  collectTelemetry(): void {
    this.#tracker.collectTelemetry()
  }

  query(params: QueryParams<XcmQueryArgs>): Promise<QueryResult> {
    switch (params.args.op) {
      case 'journeys.list':
        return this.#explorer.listJourneys(params.args.criteria, params.pagination)
      case 'journeys.by_id':
        return this.#explorer.getJourneyById(params.args.criteria)
      default:
        if (this.#analytics) {
          return this.#analytics.query(params)
        }
        throw new Error('analytics are not enabled')
    }
  }

  onServerSideEventsRequest(request: ServerSideEventsRequest<XcmServerSideEventArgs>) {
    this.#sseBroadcaster.stream(request)
  }

  /**
   * Main monitoring logic.
   *
   * This method sets up and manages subscriptions for XCM messages based on the provided
   * subscription information.
   *
   * @param {Subscription} subscription - The subscription descriptor.
   * @throws {Error} If there is an error during the subscription setup process.
   * @private
   */
  #monitor(subscription: Subscription<XcmInputs>): XcmSubscriptionHandler {
    const {
      id,
      args: { origins, destinations, senders, events, history },
    } = subscription

    const sendersControl = ControlQuery.from(sendersCriteria(senders))
    const originsControl = ControlQuery.from(messageCriteria(origins))
    const destinationsControl = ControlQuery.from(messageCriteria(destinations))
    const notificationTypeControl = ControlQuery.from(notificationTypeCriteria(events))

    const tracker$ =
      history === undefined
        ? this.#tracker.xcm$
        : this.#tracker.historicalXcm$({ ...history, agent: this.id })
    const stream = tracker$
      .pipe(
        filter((payload) => {
          return (
            matchNotificationType(notificationTypeControl, payload.type) &&
            matchMessage(originsControl, payload.origin) &&
            matchMessage(destinationsControl, payload.destination) &&
            matchSenders(sendersControl, payload.sender)
          )
        }),
        mergeMap((payload: XcmMessagePayload) => this.#humanizer.humanize(payload)),
      )
      .subscribe({
        next: (payload: HumanizedXcmPayload) => {
          if (this.#subs.has(id)) {
            const { subscription } = this.#subs.get(id)
            this.#notifier.publish(subscription, {
              metadata: {
                type: payload.type,
                subscriptionId: id,
                agentId: this.id,
                networkId: payload.waypoint.chainId,
                timestamp: Date.now(),
                blockTimestamp: payload.waypoint.timestamp,
              },
              payload: asSerializable(payload) as unknown as AnyJson,
            })
          } else {
            // this could happen with closed ephemeral subscriptions
            this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
          }
        },
        complete: () => {
          if (this.#subs.has(id)) {
            const { subscription } = this.#subs.get(id)
            if (subscription.ephemeral) {
              this.#notifier.terminate(subscription)
            }
          }
        },
      })

    return {
      subscription,
      stream,
      sendersControl,
      originsControl,
      destinationsControl,
      notificationTypeControl,
    }
  }

  #validateSenders({ senders }: XcmInputs) {
    try {
      sendersCriteria(senders)
    } catch {
      throw new ValidationError('Invalid senders')
    }
  }

  #validateHistorical({ args: { history }, ephemeral }: Subscription<XcmInputs>) {
    if (history?.timeframe !== undefined) {
      const { end } = asDateRange(history.timeframe)
      if (end !== undefined && ephemeral !== true) {
        throw new ValidationError('Persistent subscriptions cannot specify closed timeframes')
      }
    }
  }

  #validateAllowances({ args }: Subscription<XcmInputs>, account?: AccountWithCaps) {
    // for the time being to keep it simple, we just allow historical subscriptions
    // to write capabilities
    if (args.history !== undefined && args.history !== null) {
      if (account !== undefined && account.caps.includes(CAP_WRITE)) {
        return
      }
      throw new ValidationError('Historical subscriptions are not allowed for read-only accounts')
    }
  }

  #validateChainIds({ destinations, origins }: XcmInputs) {
    if (destinations !== '*') {
      destinations.forEach((chainId) => {
        if (!this.#ingress.isNetworkDefined(chainId as NetworkURN)) {
          throw new ValidationError('Invalid destination chain id:' + chainId)
        }
      })
    }

    if (origins !== '*') {
      origins.forEach((chainId) => {
        if (!this.#ingress.isNetworkDefined(chainId as NetworkURN)) {
          throw new ValidationError('Invalid origin chain id:' + chainId)
        }
      })
    }
  }
}

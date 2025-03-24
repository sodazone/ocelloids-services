import { Operation } from 'rfc6902'
import { filter } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
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
  Subscribable,
  getAgentCapabilities,
} from '../types.js'

import { asDateRange } from '@/services/archive/time.js'
import { XcmAnalytics } from './analytics/index.js'
import { $XcmQueryArgs, XcmQueryArgs } from './analytics/types.js'
import { XcmSubscriptionManager } from './handlers.js'
import {
  matchMessage,
  matchNotificationType,
  matchSenders,
  messageCriteria,
  notificationTypeCriteria,
  sendersCriteria,
} from './ops/criteria.js'
import { XcmTracker } from './tracking.js'
import { $XcmInputs, XcmInputs, XcmMessagePayload, XcmSubscriptionHandler } from './types.js'

export const XCM_AGENT_ID = 'xcm'

/**
 * The XCM monitoring agent.
 *
 * Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
 */
export class XcmAgent implements Agent, Subscribable, Queryable {
  id = XCM_AGENT_ID

  querySchema = $XcmQueryArgs
  inputSchema = $XcmInputs

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

  #analytics?: XcmAnalytics

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log

    this.#ingress = ctx.ingress.substrate
    this.#notifier = ctx.egress

    this.#subs = new XcmSubscriptionManager(ctx.log, ctx.ingress, this)
    this.#tracker = new XcmTracker(ctx)

    try {
      if (ctx.analyticsDB !== undefined) {
        this.#analytics = new XcmAnalytics({
          log: ctx.log,
          catalog: ctx.agentCatalog,
          db: ctx.analyticsDB,
        })
      }
    } catch (error: unknown) {
      this.#log.error(error, '[agent:%s] could not start analytics', this.id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    return this.#subs.update(subscriptionId, patch)
  }

  subscribe(subscription: Subscription<XcmInputs>): void {
    const { id, args } = subscription

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

  start(subs: Subscription<XcmInputs>[] = []) {
    this.#tracker.start()

    this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

    for (const sub of subs) {
      try {
        this.#subs.set(sub.id, this.#monitor(sub))
      } catch (error) {
        this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
      }
    }

    this.#analytics?.start(this.#tracker)
  }

  async stop(): Promise<void> {
    this.#subs.stop()
    await this.#tracker.stop()

    this.#analytics?.stop()
  }

  getSubscriptionHandler(subscriptionId: string): XcmSubscriptionHandler {
    return this.#subs.get(subscriptionId)
  }

  collectTelemetry(): void {
    this.#tracker.collectTelemetry()
  }

  query(params: QueryParams<XcmQueryArgs>): Promise<QueryResult> {
    if (this.#analytics) {
      return this.#analytics.query(params)
    }

    throw new Error('analytics are not enabled')
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
      )
      .subscribe({
        next: (payload: XcmMessagePayload) => {
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
              payload: payload as unknown as AnyJson,
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

import { EventEmitter } from 'node:events'

import { Operation } from 'rfc6902'
import { Observable, filter, from, map, switchMap } from 'rxjs'
import { z } from 'zod'

import { ControlQuery } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { Egress } from '@/services/egress/hub.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { HexString, RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'

import { SharedStreams } from '../base/shared.js'
import { Agent, AgentMetadata, AgentRuntimeContext, Subscribable, getAgentCapabilities } from '../types.js'

import { XcmSubscriptionManager } from './handlers.js'
import { MatchingEngine } from './matching.js'
import {
  GetDownwardMessageQueues,
  GetOutboundHrmpMessages,
  GetOutboundUmpMessages,
} from './types-augmented.js'
import {
  $XcmInputs,
  Monitor,
  RxBridgeSubscription,
  XcmInbound,
  XcmInboundWithContext,
  XcmInputs,
  XcmMessagePayload,
  XcmNotificationType,
  XcmRelayedWithContext,
  XcmSentWithContext,
  XcmSubscriptionHandler,
} from './types.js'

import { mapXcmSent } from './ops/common.js'
import { matchMessage, matchSenders, messageCriteria, sendersCriteria } from './ops/criteria.js'
import { extractDmpReceive, extractDmpSendByEvent } from './ops/dmp.js'
import { extractRelayReceive } from './ops/relay.js'
import { extractUmpReceive, extractUmpSend } from './ops/ump.js'
import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js'

import { ApiContext } from '@/services/networking/index.js'
import { TelemetryXcmEventEmitter } from './telemetry/events.js'
import { xcmAgentMetrics, xcmMatchingEngineMetrics } from './telemetry/metrics.js'

/**
 * The XCM monitoring agent.
 *
 * Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
 */
export class XcmAgent implements Agent, Subscribable {
  readonly #log: Logger

  readonly #notifier: Egress
  readonly #ingress: IngressConsumer
  readonly #engine: MatchingEngine
  readonly #telemetry: TelemetryXcmEventEmitter

  readonly #shared: SharedStreams
  readonly #subs: XcmSubscriptionManager

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log

    this.#notifier = ctx.egress
    this.#ingress = ctx.ingress
    this.#engine = new MatchingEngine(ctx, this.#onXcmWaypointReached.bind(this))
    this.#telemetry = new (EventEmitter as new () => TelemetryXcmEventEmitter)()

    this.#subs = new XcmSubscriptionManager(ctx.log, this.#ingress, this)
    this.#shared = SharedStreams.instance(this.#ingress)
  }

  get id() {
    return 'xcm'
  }

  get inputSchema(): z.ZodSchema {
    return $XcmInputs
  }

  get metadata(): AgentMetadata {
    return {
      name: 'XCM Agent',
      description: `
      Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
      Currently supports XCMP-lite (HRMP) and VMP.
      `,
      capabilities: getAgentCapabilities(this),
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    return this.#subs.update(subscriptionId, patch)
  }

  subscribe(subscription: Subscription<XcmInputs>): void {
    const { id, args } = subscription
    const origin = args.origin as NetworkURN
    const dests = args.destinations as NetworkURN[]

    this.#validateChainIds([origin, ...dests])
    const handler = this.#monitor(subscription)
    this.#subs.set(id, handler)
  }

  async unsubscribe(id: string): Promise<void> {
    if (!this.#subs.has(id)) {
      this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
      return
    }

    try {
      const handler = this.#subs.get(id)
      this.#closeHandler(handler)

      this.#subs.delete(id)

      await this.#engine.clearPendingStates(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  async start(subs: Subscription<XcmInputs>[] = []): Promise<void> {
    this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

    for (const sub of subs) {
      try {
        this.#subs.set(sub.id, await this.#monitor(sub))
      } catch (error) {
        this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
      }
    }
  }

  async stop(): Promise<void> {
    for (const handler of this.#subs.all()) {
      this.#closeHandler(handler)
    }

    this.#subs.stop()

    await this.#engine.stop()
  }

  getSubscriptionHandler(subscriptionId: string): XcmSubscriptionHandler {
    return this.#subs.get(subscriptionId)
  }

  collectTelemetry(): void {
    xcmAgentMetrics(this.#telemetry)
    xcmMatchingEngineMetrics(this.#engine)
  }

  /**
   * Set up inbound monitors for XCM protocols.
   *
   * @private
   */
  __monitorDestinations({ id, args: { origin, destinations } }: Subscription<XcmInputs>): Monitor {
    const subs: RxSubscriptionWithId[] = []
    const originId = origin as NetworkURN
    try {
      for (const dest of destinations as NetworkURN[]) {
        const chainId = dest
        if (this.#subs.hasSubscriptionForDestination(id, chainId)) {
          // Skip existing subscriptions
          // for the same destination chain
          continue
        }

        const inboundObserver = {
          error: (error: any) => {
            this.#log.error(error, '[%s:%s] error on destination subscription %s', this.id, chainId, id)

            this.#telemetry.emit('telemetryXcmSubscriptionError', {
              subscriptionId: id,
              chainId,
              direction: 'in',
            })

            this.#subs.tryRecoverInbound(error, id, chainId)
          },
        }

        if (this.#ingress.isRelay(dest)) {
          // VMP UMP
          this.#log.info('[%s:%s] subscribe inbound UMP (%s)', this.id, chainId, id)

          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractUmpReceive(originId), this.#emitInbound(id, chainId))
              .subscribe(inboundObserver),
          })
        } else if (this.#ingress.isRelay(originId)) {
          // VMP DMP
          this.#log.info('[%s:%s] subscribe inbound DMP (%s)', this.id, chainId, id)

          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractDmpReceive(), this.#emitInbound(id, chainId))
              .subscribe(inboundObserver),
          })
        } else {
          // Inbound HRMP / XCMP transport
          this.#log.info('[%s:%s] subscribe inbound HRMP (%s)', this.id, chainId, id)

          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractXcmpReceive(), this.#emitInbound(id, chainId))
              .subscribe(inboundObserver),
          })
        }
      }
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    return { streams: subs, controls: {} }
  }

  /**
   * Set up outbound monitors for XCM protocols.
   *
   * @private
   */
  __monitorOrigins({
    id,
    args: { origin, senders, destinations, outboundTTL },
  }: Subscription<XcmInputs>): Monitor {
    const subs: RxSubscriptionWithId[] = []
    const chainId = origin as NetworkURN

    const sendersControl = ControlQuery.from(sendersCriteria(senders))
    const messageControl = ControlQuery.from(messageCriteria(destinations as NetworkURN[]))

    const outboundObserver = {
      error: (error: any) => {
        this.#log.error(error, '[%s:%s] error on origin subscription %s', this.id, chainId, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId,
          direction: 'out',
        })

        this.#subs.tryRecoverOutbound(error, id, chainId)
      },
    }

    try {
      if (this.#ingress.isRelay(chainId)) {
        // VMP DMP
        this.#log.info('[%s:%s] subscribe outbound DMP (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getContext(chainId)
            .pipe(
              switchMap((context) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractDmpSendByEvent(chainId, this.#getDmp(chainId, context), context),
                    this.#emitOutbound({ id, origin: chainId, context, messageControl, outboundTTL }),
                  ),
              ),
            )
            .subscribe(outboundObserver),
        })
      } else {
        // Outbound HRMP / XCMP transport
        this.#log.info('[%s:%s] subscribe outbound HRMP (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getContext(chainId)
            .pipe(
              switchMap((context) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractXcmpSend(chainId, this.#getHrmp(chainId, context), context),
                    this.#emitOutbound({ id, origin: chainId, context, messageControl, outboundTTL }),
                  ),
              ),
            )
            .subscribe(outboundObserver),
        })

        // VMP UMP
        this.#log.info('[%s:%s] subscribe outbound UMP (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getContext(chainId)
            .pipe(
              switchMap((context) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractUmpSend(chainId, this.#getUmp(chainId, context), context),
                    this.#emitOutbound({ id, origin: chainId, context, messageControl, outboundTTL }),
                  ),
              ),
            )
            .subscribe(outboundObserver),
        })
      }
    } catch (error) {
      /* istanbul ignore next */
      // Clean up subscriptions.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      /* istanbul ignore next */
      throw error
    }

    return {
      streams: subs,
      controls: {
        sendersControl,
        messageControl,
      },
    }
  }

  __monitorRelay({ id, args: { origin, destinations } }: Subscription<XcmInputs>) {
    const chainId = origin as NetworkURN
    const existingRelaySub = this.#subs.get(id)?.relaySub
    if (existingRelaySub !== undefined) {
      this.#log.debug('Relay subscription already exists.')
      return existingRelaySub
    }

    const messageControl = ControlQuery.from(messageCriteria(destinations as NetworkURN[]))

    const emitRelayInbound = () => (source: Observable<XcmRelayedWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onRelayedMessage(id, message))))

    const relayObserver = {
      error: (error: any) => {
        this.#log.error(error, '[%s:%s] error on relay subscription %s', this.id, chainId, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId,
          direction: 'relay',
        })

        this.#subs.tryRecoverRelay(error, id, chainId)
      },
    }

    // TODO: should resolve relay id for consensus in context
    const relayIds = this.#ingress.getRelayIds()
    const relayId = relayIds.find((r) => getConsensus(r) === getConsensus(chainId))

    if (relayId === undefined) {
      throw new Error(`No relay ID found for chain ${chainId}`)
    }
    this.#log.info('[%s:%s] subscribe relay %s xcm events (%s)', this.id, chainId, relayId, id)
    return {
      chainId,
      sub: this.#ingress
        .getContext(relayId)
        .pipe(
          switchMap((context) =>
            this.#shared
              .blockExtrinsics(relayId)
              .pipe(extractRelayReceive(chainId, messageControl, context), emitRelayInbound()),
          ),
        )
        .subscribe(relayObserver),
    }
  }

  /**
   * Checks if relayed HRMP messages should be monitored.
   *
   * All of the following conditions needs to be met:
   * 1. `xcm.relayed` notification event is requested in the subscription
   * 2. Origin chain is not a relay chain
   * 3. At least one destination chain is a parachain
   *
   * @param Subscription - The subscription arguments.
   * @returns true if should monitor the relay chain.
   */
  __shouldMonitorRelay({ origin, destinations, events }: XcmInputs) {
    return (
      (events === undefined || events === '*' || events.includes(XcmNotificationType.Relayed)) &&
      !this.#ingress.isRelay(origin as NetworkURN) &&
      destinations.some((d) => !this.#ingress.isRelay(d as NetworkURN))
    )
  }

  #onXcmWaypointReached(payload: XcmMessagePayload) {
    const { subscriptionId } = payload
    if (this.#subs.has(subscriptionId)) {
      const { subscription, sendersControl } = this.#subs.get(subscriptionId)
      const { args } = subscription
      if (
        (args.events === undefined || args.events === '*' || args.events.includes(payload.type)) &&
        matchSenders(sendersControl, payload.sender)
      ) {
        this.#notifier.publish(subscription, {
          metadata: {
            type: payload.type,
            subscriptionId,
            agentId: this.id,
            networkId: payload.waypoint.chainId,
            timestamp: Date.now(),
            blockTimestamp: payload.waypoint.timestamp,
          },
          payload: payload as unknown as AnyJson,
        })
      }
    } else {
      // this could happen with closed ephemeral subscriptions
      this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, subscriptionId)
    }
  }

  /**
   * Main monitoring logic.
   *
   * This method sets up and manages subscriptions for XCM messages based on the provided
   * subscription information. It creates subscriptions for both the origin and destination
   * networks, monitors XCM message transfers, and emits events accordingly.
   *
   * @param {Subscription} subscription - The subscription descriptor.
   * @throws {Error} If there is an error during the subscription setup process.
   * @private
   */
  #monitor(subscription: Subscription<XcmInputs>): XcmSubscriptionHandler {
    const { args } = subscription

    let origMonitor: Monitor = { streams: [], controls: {} }
    let destMonitor: Monitor = { streams: [], controls: {} }
    let relaySub: RxSubscriptionWithId | undefined

    const bridgeSubs: RxBridgeSubscription[] = []

    try {
      origMonitor = this.__monitorOrigins(subscription)
      destMonitor = this.__monitorDestinations(subscription)

      // Only subscribe to relay events if required by subscription.
      // Contained in its own try-catch so it doesn't prevent origin-destination subs in case of error.
      if (this.__shouldMonitorRelay(args)) {
        relaySub = this.__monitorRelay(subscription)
      }

      const { sendersControl, messageControl } = origMonitor.controls

      return {
        subscription,
        sendersControl,
        messageControl,
        originSubs: origMonitor.streams,
        destinationSubs: destMonitor.streams,
        bridgeSubs,
        relaySub,
      }
    } catch (error) {
      this.#closeHandler({
        subscription,
        originSubs: origMonitor.streams,
        destinationSubs: destMonitor.streams,
        bridgeSubs,
        relaySub,
      })
      throw error
    }
  }

  #emitInbound(id: string, chainId: NetworkURN) {
    return (source: Observable<XcmInboundWithContext>) =>
      source.pipe(switchMap((msg) => from(this.#engine.onInboundMessage(new XcmInbound(id, chainId, msg)))))
  }

  #emitOutbound({
    id,
    origin,
    context,
    messageControl,
    outboundTTL,
  }: {
    id: string
    origin: NetworkURN
    context: ApiContext
    messageControl: ControlQuery
    outboundTTL?: number
  }) {
    return (source: Observable<XcmSentWithContext>) =>
      source.pipe(
        mapXcmSent(id, context, origin),
        filter((msg) => matchMessage(messageControl, msg)),
        switchMap((outbound) => from(this.#engine.onOutboundMessage(outbound, outboundTTL))),
      )
  }

  #getDmp(chainId: NetworkURN, context: ApiContext): GetDownwardMessageQueues {
    const codec = context.storageCodec('Dmp', 'DownwardMessageQueues')
    return (blockHash: HexString, networkId: NetworkURN) => {
      const paraId = getChainId(networkId)
      const key = codec.enc(paraId) as HexString
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.dec(buffer)
        }),
      )
    }
  }

  #getUmp(chainId: NetworkURN, context: ApiContext): GetOutboundUmpMessages {
    const codec = context.storageCodec('ParachainSystem', 'UpwardMessages')
    const key = codec.enc() as HexString
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.dec(buffer)
        }),
      )
    }
  }

  #getHrmp(chainId: NetworkURN, context: ApiContext): GetOutboundHrmpMessages {
    const codec = context.storageCodec('ParachainSystem', 'HrmpOutboundMessages')
    const key = codec.enc() as HexString
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.dec(buffer)
        }),
      )
    }
  }

  #closeHandler(handler: Omit<XcmSubscriptionHandler, 'sendersControl' | 'messageControl'>) {
    const { subscription, originSubs, destinationSubs, relaySub, bridgeSubs } = handler

    this.#log.info('[agent:%s] close handlers %s', this.id, subscription.id)

    originSubs.forEach(({ sub }) => sub.unsubscribe())
    destinationSubs.forEach(({ sub }) => sub.unsubscribe())
    if (relaySub) {
      relaySub.sub.unsubscribe()
    }

    bridgeSubs.forEach(({ subs }) => {
      for (const { sub } of subs) {
        sub.unsubscribe()
      }
    })
  }

  #validateChainIds(chainIds: NetworkURN[]) {
    chainIds.forEach((chainId) => {
      if (!this.#ingress.isNetworkDefined(chainId)) {
        throw new ValidationError('Invalid chain id:' + chainId)
      }
    })
  }
}

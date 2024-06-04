import { EventEmitter } from 'node:events'

import { Registry } from '@polkadot/types-codec/types'
import { ControlQuery } from '@sodazone/ocelloids-sdk'
import { Operation } from 'rfc6902'
import { Observable, filter, from, map, switchMap } from 'rxjs'
import { z } from 'zod'

import { ValidationError } from '../../../errors.js'
import { IngressConsumer } from '../../../services/ingress/index.js'
import { getChainId, getConsensus } from '../../config.js'
import { Egress } from '../../egress/hub.js'
import { AnyJson, HexString, RxSubscriptionWithId, Subscription } from '../../subscriptions/types.js'
import { Logger, NetworkURN } from '../../types.js'

import { SharedStreams } from '../base/shared.js'
import { Agent, AgentMetadata, AgentRuntimeContext } from '../types.js'

import { XcmSubscriptionManager } from './handlers.js'
import { MatchingEngine } from './matching.js'
import {
  dmpDownwardMessageQueuesKey,
  parachainSystemHrmpOutboundMessages,
  parachainSystemUpwardMessages,
} from './storage.js'
import { GetDownwardMessageQueues, GetOutboundHrmpMessages, GetOutboundUmpMessages } from './types-augmented.js'
import {
  $XcmInputs,
  BridgeType,
  Monitor,
  RxBridgeSubscription,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
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
import { extractDmpReceive, extractDmpSend, extractDmpSendByEvent } from './ops/dmp.js'
import { extractBridgeMessageAccepted, extractBridgeMessageDelivered, extractBridgeReceive } from './ops/pk-bridge.js'
import { extractRelayReceive } from './ops/relay.js'
import { extractUmpReceive, extractUmpSend } from './ops/ump.js'
import { getBridgeHubNetworkId } from './ops/util.js'
import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js'

import { TelemetryXcmEventEmitter } from './telemetry/events.js'
import { xcmAgentMetrics, xcmMatchingEngineMetrics } from './telemetry/metrics.js'

/**
 * The XCM monitoring agent.
 *
 * Monitors Cross-consensus Message Format (XCM) program executions across consensus systems.
 */
export class XcmAgent implements Agent {
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

    this.#subs = new XcmSubscriptionManager(ctx.log, this)
    this.#shared = new SharedStreams(this.#ingress)
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
    }
  }

  async update(subscriptionId: string, patch: Operation[]): Promise<Subscription> {
    return this.#subs.update(subscriptionId, patch)
  }

  async subscribe(subscription: Subscription<XcmInputs>): Promise<void> {
    const { id, args } = subscription
    const origin = args.origin as NetworkURN
    const dests = args.destinations as NetworkURN[]

    this.#validateChainIds([origin, ...dests])

    const handler = await this.#monitor(subscription)
    this.#subs.set(id, handler)
  }

  async unsubscribe(id: string): Promise<void> {
    if (!this.#subs.has(id)) {
      this.#log.warn('[%s] unsubscribe from a non-existent subscription %s', this.id, id)
      return
    }

    try {
      const {
        subscription: {
          args: { origin },
        },
        originSubs,
        destinationSubs,
        relaySub,
      } = this.#subs.get(id)

      this.#log.info('[%s:%s] unsubscribe %s', this.id, origin, id)

      originSubs.forEach(({ sub }) => sub.unsubscribe())
      destinationSubs.forEach(({ sub }) => sub.unsubscribe())
      if (relaySub) {
        relaySub.sub.unsubscribe()
      }

      this.#subs.delete(id)

      await this.#engine.clearPendingStates(id)
    } catch (error) {
      this.#log.error(error, '[%s] error unsubscribing %s', this.id, id)
    }
  }

  async start(subs: Subscription<XcmInputs>[]): Promise<void> {
    this.#log.info('[%s] creating stored subscriptions (%d)', this.id, subs.length)

    for (const sub of subs) {
      try {
        this.#subs.set(sub.id, await this.#monitor(sub))
      } catch (error) {
        this.#log.error(error, '[%s] unable to create subscription: %j', this.id, sub)
      }
    }
  }

  async stop(): Promise<void> {
    for (const {
      subscription: { id },
      originSubs,
      destinationSubs,
      relaySub,
    } of this.#subs.all()) {
      this.#log.info('[%s] unsubscribe %s', this.id, id)

      originSubs.forEach(({ sub }) => sub.unsubscribe())
      destinationSubs.forEach(({ sub }) => sub.unsubscribe())
      if (relaySub) {
        relaySub.sub.unsubscribe()
      }
    }

    this.#subs.stop()

    await this.#engine.stop()
  }

  getSubscriptionHandler(subscriptionId: string): XcmSubscriptionHandler {
    return this.#subs.getSubscriptionHandler(subscriptionId)
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
  __monitorOrigins({ id, args: { origin, senders, destinations } }: Subscription<XcmInputs>): Monitor {
    const subs: RxSubscriptionWithId[] = []
    const chainId = origin as NetworkURN

    if (this.#subs.hasSubscriptionForOrigin(id, chainId)) {
      throw new Error(`Fatal: duplicated origin monitor ${id} for chain ${chainId}`)
    }

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
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.#shared
                  .blockExtrinsics(chainId)
                  .pipe(
                    extractDmpSend(chainId, this.#getDmp(chainId, registry), registry),
                    this.#emitOutbound(id, chainId, registry, messageControl)
                  )
              )
            )
            .subscribe(outboundObserver),
        })

        // VMP DMP
        this.#log.info('[%s:%s] subscribe outbound DMP - by event (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractDmpSendByEvent(chainId, this.#getDmp(chainId, registry), registry),
                    this.#emitOutbound(id, chainId, registry, messageControl)
                  )
              )
            )
            .subscribe(outboundObserver),
        })
      } else {
        // Outbound HRMP / XCMP transport
        this.#log.info('[%s:%s] subscribe outbound HRMP (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractXcmpSend(chainId, this.#getHrmp(chainId, registry), registry),
                    this.#emitOutbound(id, chainId, registry, messageControl)
                  )
              )
            )
            .subscribe(outboundObserver),
        })

        // VMP UMP
        this.#log.info('[%s:%s] subscribe outbound UMP (%s)', this.id, chainId, id)

        subs.push({
          chainId,
          sub: this.#ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(
                    extractUmpSend(chainId, this.#getUmp(chainId, registry), registry),
                    this.#emitOutbound(id, chainId, registry, messageControl)
                  )
              )
            )
            .subscribe(outboundObserver),
        })
      }
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
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
    if (this.#subs.hasSubscriptionForRelay(id)) {
      this.#log.debug('Relay subscription already exists.')
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
        .getRegistry(relayId)
        .pipe(
          switchMap((registry) =>
            this.#shared
              .blockExtrinsics(relayId)
              .pipe(extractRelayReceive(chainId, messageControl, registry), emitRelayInbound())
          )
        )
        .subscribe(relayObserver),
    }
  }

  // Assumes only 1 pair of bridge hub origin-destination is possible
  // TODO: handle possible multiple different consensus utilizing PK bridge e.g. solochains?
  __monitorPkBridge({ id, args: { origin, destinations } }: Subscription<XcmInputs>) {
    const originBridgeHub = getBridgeHubNetworkId(origin as NetworkURN)
    const dest = (destinations as NetworkURN[]).find((d) => getConsensus(d) !== getConsensus(origin as NetworkURN))

    if (dest === undefined) {
      throw new Error(`No destination on different consensus found for bridging (sub=${id})`)
    }

    const destBridgeHub = getBridgeHubNetworkId(dest)

    if (originBridgeHub === undefined || destBridgeHub === undefined) {
      throw new Error(
        `Unable to subscribe to PK bridge due to missing bridge hub network URNs for origin=${origin} and destinations=${destinations}. (sub=${id})`
      )
    }

    const type: BridgeType = 'pk-bridge'

    if (this.#subs.hasSubscriptionForBridge(id, type)) {
      throw new Error(`Fatal: duplicated PK bridge monitor ${id}`)
    }

    const emitBridgeOutboundAccepted = () => (source: Observable<XcmBridgeAcceptedWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeOutboundAccepted(id, message))))

    const emitBridgeOutboundDelivered = () => (source: Observable<XcmBridgeDeliveredWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeOutboundDelivered(id, message))))

    const emitBridgeInbound = () => (source: Observable<XcmBridgeInboundWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeInbound(id, message))))

    const pkBridgeObserver = {
      error: (error: any) => {
        this.#log.error(error, '[%s:%s] error on PK bridge subscription %s', this.id, originBridgeHub, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId: originBridgeHub,
          direction: 'bridge',
        })

        this.#subs.tryRecoverBridge(error, id, type, originBridgeHub)
      },
    }

    this.#log.info(
      '[%s:%s] subscribe PK bridge outbound accepted events on bridge hub %s (%s)',
      this.id,
      origin,
      originBridgeHub,
      id
    )
    const outboundAccepted: RxSubscriptionWithId = {
      chainId: originBridgeHub,
      sub: this.#ingress
        .getRegistry(originBridgeHub)
        .pipe(
          switchMap((registry) =>
            this.#shared.blockEvents(originBridgeHub).pipe(
              extractBridgeMessageAccepted(originBridgeHub, registry, (blockHash: HexString, key: HexString) => {
                return from(this.#ingress.getStorage(originBridgeHub, key, blockHash))
              }),
              emitBridgeOutboundAccepted()
            )
          )
        )
        .subscribe(pkBridgeObserver),
    }

    this.#log.info(
      '[%s:%s] subscribe PK bridge outbound delivered events on bridge hub %s (%s)',
      this.id,
      origin,
      originBridgeHub,
      id
    )
    const outboundDelivered: RxSubscriptionWithId = {
      chainId: originBridgeHub,
      sub: this.#ingress
        .getRegistry(originBridgeHub)
        .pipe(
          switchMap((registry) =>
            this.#shared
              .blockEvents(originBridgeHub)
              .pipe(extractBridgeMessageDelivered(originBridgeHub, registry), emitBridgeOutboundDelivered())
          )
        )
        .subscribe(pkBridgeObserver),
    }

    this.#log.info(
      '[%s:%s] subscribe PK bridge inbound events on bridge hub %s (%s)',
      this.id,
      origin,
      destBridgeHub,
      id
    )
    const inbound: RxSubscriptionWithId = {
      chainId: destBridgeHub,
      sub: this.#shared
        .blockEvents(destBridgeHub)
        .pipe(extractBridgeReceive(destBridgeHub), emitBridgeInbound())
        .subscribe(pkBridgeObserver),
    }

    return {
      type,
      subs: [outboundAccepted, outboundDelivered, inbound],
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
          },
          payload: payload as unknown as AnyJson,
        })
      }
    } else {
      // this could happen with closed ephemeral subscriptions
      this.#log.warn('[%s] unable to find descriptor for subscription %s', this.id, subscriptionId)
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
    const { id, args } = subscription

    let origMonitor: Monitor = { streams: [], controls: {} }
    let destMonitor: Monitor = { streams: [], controls: {} }
    const bridgeSubs: RxBridgeSubscription[] = []
    let relaySub: RxSubscriptionWithId | undefined

    try {
      origMonitor = this.__monitorOrigins(subscription)
      destMonitor = this.__monitorDestinations(subscription)
    } catch (error) {
      // Clean up origin subscriptions.
      origMonitor.streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    // Only subscribe to relay events if required by subscription.
    // Contained in its own try-catch so it doesn't prevent origin-destination subs in case of error.
    if (this.__shouldMonitorRelay(args)) {
      try {
        relaySub = this.__monitorRelay(subscription)
      } catch (error) {
        // log instead of throw to not block OD subscriptions
        this.#log.error(error, '[%s] error on relay subscription %s', this.id, id)
      }
    }

    if (args.bridges !== undefined) {
      if (args.bridges.includes('pk-bridge')) {
        try {
          bridgeSubs.push(this.__monitorPkBridge(subscription))
        } catch (error) {
          // log instead of throw to not block OD subscriptions
          this.#log.error(error, '[%s] error on bridge subscription %s', this.id, id)
        }
      }
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
  }

  #emitInbound(id: string, chainId: NetworkURN) {
    return (source: Observable<XcmInboundWithContext>) =>
      source.pipe(switchMap((msg) => from(this.#engine.onInboundMessage(new XcmInbound(id, chainId, msg)))))
  }

  #emitOutbound(id: string, origin: NetworkURN, registry: Registry, messageControl: ControlQuery) {
    const {
      subscription: {
        args: { outboundTTL },
      },
    } = this.#subs.get(id)

    return (source: Observable<XcmSentWithContext>) =>
      source.pipe(
        mapXcmSent(id, registry, origin),
        filter((msg) => matchMessage(messageControl, msg)),
        switchMap((outbound) => from(this.#engine.onOutboundMessage(outbound, outboundTTL)))
      )
  }

  #getDmp(chainId: NetworkURN, registry: Registry): GetDownwardMessageQueues {
    return (blockHash: HexString, networkId: NetworkURN) => {
      const paraId = getChainId(networkId)
      return from(this.#ingress.getStorage(chainId, dmpDownwardMessageQueuesKey(registry, paraId), blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<PolkadotCorePrimitivesInboundDownwardMessage>', buffer)
        })
      )
    }
  }

  #getUmp(chainId: NetworkURN, registry: Registry): GetOutboundUmpMessages {
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, parachainSystemUpwardMessages, blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<Bytes>', buffer)
        })
      )
    }
  }

  #getHrmp(chainId: NetworkURN, registry: Registry): GetOutboundHrmpMessages {
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, parachainSystemHrmpOutboundMessages, blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<PolkadotCorePrimitivesOutboundHrmpMessage>', buffer)
        })
      )
    }
  }

  #validateChainIds(chainIds: NetworkURN[]) {
    chainIds.forEach((chainId) => {
      if (!this.#ingress.isNetworkDefined(chainId)) {
        throw new ValidationError('Invalid chain id:' + chainId)
      }
    })
  }
}

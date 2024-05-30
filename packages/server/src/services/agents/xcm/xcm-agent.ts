import { Registry } from '@polkadot/types-codec/types'
import { ControlQuery } from '@sodazone/ocelloids-sdk'
import { Operation, applyPatch } from 'rfc6902'
import { Observable, filter, from, map, switchMap } from 'rxjs'
import { z } from 'zod'

import { $Subscription, AnyJson, HexString, RxSubscriptionWithId, Subscription } from '../../subscriptions/types.js'
import { NetworkURN } from '../../types.js'
import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js'
import {
  $XCMSubscriptionArgs,
  BridgeSubscription,
  BridgeType,
  Monitor,
  XCMSubscriptionArgs,
  XCMSubscriptionHandler,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
  XcmInbound,
  XcmInboundWithContext,
  XcmMessagePayload,
  XcmNotificationType,
  XcmRelayedWithContext,
  XcmSentWithContext,
} from './types.js'

import { MatchingEngine } from './matching.js'

import { ValidationError, errorMessage } from '../../../errors.js'
import { mapXcmSent } from './ops/common.js'
import { matchMessage, matchSenders, messageCriteria, sendersCriteria } from './ops/criteria.js'
import { extractDmpReceive, extractDmpSend, extractDmpSendByEvent } from './ops/dmp.js'
import { extractRelayReceive } from './ops/relay.js'
import { extractUmpReceive, extractUmpSend } from './ops/ump.js'

import { EventEmitter } from 'node:events'
import { getChainId, getConsensus } from '../../config.js'
import { BaseAgent } from '../base/base-agent.js'
import { AgentMetadata, AgentRuntimeContext } from '../types.js'
import { extractBridgeMessageAccepted, extractBridgeMessageDelivered, extractBridgeReceive } from './ops/pk-bridge.js'
import { getBridgeHubNetworkId } from './ops/util.js'
import {
  dmpDownwardMessageQueuesKey,
  parachainSystemHrmpOutboundMessages,
  parachainSystemUpwardMessages,
} from './storage.js'
import { TelemetryXCMEventEmitter } from './telemetry/events.js'
import { xcmAgentMetrics, xcmAgentEngineMetrics as xcmMatchingEngineMetrics } from './telemetry/metrics.js'
import { GetDownwardMessageQueues, GetOutboundHrmpMessages, GetOutboundUmpMessages } from './types-augmented.js'

const SUB_ERROR_RETRY_MS = 5000

const allowedPaths = ['/args/senders', '/args/destinations', '/channels', '/args/events']

function hasOp(patch: Operation[], path: string) {
  return patch.some((op) => op.path.startsWith(path))
}

export class XCMAgent extends BaseAgent<XCMSubscriptionHandler> {
  readonly #engine: MatchingEngine
  readonly #telemetry: TelemetryXCMEventEmitter

  constructor(ctx: AgentRuntimeContext) {
    super(ctx)

    this.#engine = new MatchingEngine(ctx, this.#onXcmWaypointReached.bind(this))
    this.#telemetry = new (EventEmitter as new () => TelemetryXCMEventEmitter)()
  }

  async update(subscriptionId: string, patch: Operation[]): Promise<Subscription> {
    const sub = this.subs[subscriptionId]
    const descriptor = sub.descriptor

    // Check allowed patch ops
    const allowedOps = patch.every((op) => allowedPaths.some((s) => op.path.startsWith(s)))

    if (allowedOps) {
      applyPatch(descriptor, patch)
      $Subscription.parse(descriptor)
      const args = $XCMSubscriptionArgs.parse(descriptor.args)

      await this.db.save(descriptor)

      sub.args = args
      sub.descriptor = descriptor

      if (hasOp(patch, '/args/senders')) {
        this.#updateSenders(subscriptionId)
      }

      if (hasOp(patch, '/args/destinations')) {
        this.#updateDestinations(subscriptionId)
      }

      if (hasOp(patch, '/args/events')) {
        this.#updateEvents(subscriptionId)
      }

      this.#updateDescriptor(descriptor)

      return descriptor
    } else {
      throw Error('Only operations on these paths are allowed: ' + allowedPaths.join(','))
    }
  }

  getInputSchema(): z.ZodSchema {
    return $XCMSubscriptionArgs
  }

  get metadata(): AgentMetadata {
    return {
      id: 'xcm',
      name: 'XCM Agent',
    }
  }

  override collectTelemetry(): void {
    xcmAgentMetrics(this.#telemetry)
    xcmMatchingEngineMetrics(this.#engine)
  }

  async subscribe(s: Subscription): Promise<void> {
    const args = $XCMSubscriptionArgs.parse(s.args)

    const origin = args.origin as NetworkURN
    const dests = args.destinations as NetworkURN[]
    this.#validateChainIds([origin, ...dests])

    if (!s.ephemeral) {
      await this.db.insert(s)
    }

    this.#monitor(s, args)
  }

  async unsubscribe(id: string): Promise<void> {
    if (this.subs[id] === undefined) {
      this.log.warn('unsubscribe from a non-existent subscription %s', id)
      return
    }

    try {
      const {
        descriptor: { ephemeral },
        args: { origin },
        originSubs,
        destinationSubs,
        relaySub,
      } = this.subs[id]

      this.log.info('[%s] unsubscribe %s', origin, id)

      originSubs.forEach(({ sub }) => sub.unsubscribe())
      destinationSubs.forEach(({ sub }) => sub.unsubscribe())
      if (relaySub) {
        relaySub.sub.unsubscribe()
      }
      delete this.subs[id]

      await this.#engine.clearPendingStates(id)

      if (!ephemeral) {
        await this.db.remove(this.id, id)
      }
    } catch (error) {
      this.log.error(error, 'Error unsubscribing %s', id)
    }
  }
  async stop(): Promise<void> {
    for (const {
      descriptor: { id },
      originSubs,
      destinationSubs,
      relaySub,
    } of Object.values(this.subs)) {
      this.log.info('Unsubscribe %s', id)

      originSubs.forEach(({ sub }) => sub.unsubscribe())
      destinationSubs.forEach(({ sub }) => sub.unsubscribe())
      if (relaySub) {
        relaySub.sub.unsubscribe()
      }
    }

    for (const t of this.timeouts) {
      t.unref()
    }

    await this.#engine.stop()
  }

  async start(): Promise<void> {
    await this.#startNetworkMonitors()
  }

  #onXcmWaypointReached(payload: XcmMessagePayload) {
    const { subscriptionId } = payload
    if (this.subs[subscriptionId]) {
      const { descriptor, args, sendersControl } = this.subs[subscriptionId]
      if (
        (args.events === undefined || args.events === '*' || args.events.includes(payload.type)) &&
        matchSenders(sendersControl, payload.sender)
      ) {
        this.notifier.notify(descriptor, {
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
      this.log.warn('Unable to find descriptor for subscription %s', subscriptionId)
    }
  }

  /**
   * Main monitoring logic.
   *
   * This method sets up and manages subscriptions for XCM messages based on the provided
   * subscription information. It creates subscriptions for both the origin and destination
   * networks, monitors XCM message transfers, and emits events accordingly.
   *
   * @param {Subscription} descriptor - The subscription descriptor.
   * @param {XCMSubscriptionArgs} args - The coerced subscription arguments.
   * @throws {Error} If there is an error during the subscription setup process.
   * @private
   */
  #monitor(descriptor: Subscription, args: XCMSubscriptionArgs) {
    const { id } = descriptor

    let origMonitor: Monitor = { subs: [], controls: {} }
    let destMonitor: Monitor = { subs: [], controls: {} }
    const bridgeSubs: BridgeSubscription[] = []
    let relaySub: RxSubscriptionWithId | undefined

    try {
      origMonitor = this.#monitorOrigins(descriptor, args)
      destMonitor = this.#monitorDestinations(descriptor, args)
    } catch (error) {
      // Clean up origin subscriptions.
      origMonitor.subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    // Only subscribe to relay events if required by subscription.
    // Contained in its own try-catch so it doesn't prevent origin-destination subs in case of error.
    if (this.#shouldMonitorRelay(args)) {
      try {
        relaySub = this.#monitorRelay(descriptor, args)
      } catch (error) {
        // log instead of throw to not block OD subscriptions
        this.log.error(error, 'Error on relay subscription (%s)', id)
      }
    }

    if (args.bridges !== undefined) {
      if (args.bridges.includes('pk-bridge')) {
        try {
          bridgeSubs.push(this.#monitorPkBridge(descriptor, args))
        } catch (error) {
          // log instead of throw to not block OD subscriptions
          this.log.error(error, 'Error on bridge subscription (%s)', id)
        }
      }
    }

    const { sendersControl, messageControl } = origMonitor.controls

    this.subs[id] = {
      descriptor,
      args,
      sendersControl,
      messageControl,
      originSubs: origMonitor.subs,
      destinationSubs: destMonitor.subs,
      bridgeSubs,
      relaySub,
    }
  }

  /**
   * Set up inbound monitors for XCM protocols.
   *
   * @private
   */
  #monitorDestinations({ id }: Subscription, { origin, destinations }: XCMSubscriptionArgs): Monitor {
    const subs: RxSubscriptionWithId[] = []
    const originId = origin as NetworkURN
    try {
      for (const dest of destinations as NetworkURN[]) {
        const chainId = dest
        if (this.subs[id]?.destinationSubs.find((s) => s.chainId === chainId)) {
          // Skip existing subscriptions
          // for the same destination chain
          continue
        }

        const inboundObserver = {
          error: (error: any) => {
            this.log.error(error, '[%s] error on destination subscription %s', chainId, id)

            this.#telemetry.emit('telemetryXcmSubscriptionError', {
              subscriptionId: id,
              chainId,
              direction: 'in',
            })

            // try recover inbound subscription
            if (this.subs[id]) {
              const { destinationSubs } = this.subs[id]
              const index = destinationSubs.findIndex((s) => s.chainId === chainId)
              if (index > -1) {
                destinationSubs.splice(index, 1)
                this.timeouts.push(
                  setTimeout(() => {
                    this.log.info(
                      '[%s] UPDATE destination subscription %s due error %s',
                      chainId,
                      id,
                      errorMessage(error)
                    )
                    const updated = this.#updateDestinationSubscriptions(id)
                    this.subs[id].destinationSubs = updated
                  }, SUB_ERROR_RETRY_MS)
                )
              }
            }
          },
        }

        if (this.ingress.isRelay(dest)) {
          // VMP UMP
          this.log.info('[%s] subscribe inbound UMP (%s)', chainId, id)

          subs.push({
            chainId,
            sub: this.sharedBlockEvents(chainId)
              .pipe(extractUmpReceive(originId), this.#emitInbound(id, chainId))
              .subscribe(inboundObserver),
          })
        } else if (this.ingress.isRelay(originId)) {
          // VMP DMP
          this.log.info('[%s] subscribe inbound DMP (%s)', chainId, id)

          subs.push({
            chainId,
            sub: this.sharedBlockEvents(chainId)
              .pipe(extractDmpReceive(), this.#emitInbound(id, chainId))
              .subscribe(inboundObserver),
          })
        } else {
          // Inbound HRMP / XCMP transport
          this.log.info('[%s] subscribe inbound HRMP (%s)', chainId, id)

          subs.push({
            chainId,
            sub: this.sharedBlockEvents(chainId)
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

    return { subs, controls: {} }
  }

  /**
   * Set up outbound monitors for XCM protocols.
   *
   * @private
   */
  #monitorOrigins({ id }: Subscription, { origin, senders, destinations }: XCMSubscriptionArgs): Monitor {
    const subs: RxSubscriptionWithId[] = []
    const chainId = origin as NetworkURN

    if (this.subs[id]?.originSubs.find((s) => s.chainId === chainId)) {
      throw new Error(`Fatal: duplicated origin monitor ${id} for chain ${chainId}`)
    }

    const sendersControl = ControlQuery.from(sendersCriteria(senders))
    const messageControl = ControlQuery.from(messageCriteria(destinations as NetworkURN[]))

    const outboundObserver = {
      error: (error: any) => {
        this.log.error(error, '[%s] error on origin subscription %s', chainId, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId,
          direction: 'out',
        })

        // try recover outbound subscription
        // note: there is a single origin per outbound
        if (this.subs[id]) {
          const { originSubs, descriptor, args } = this.subs[id]
          const index = originSubs.findIndex((s) => s.chainId === chainId)
          if (index > -1) {
            this.subs[id].originSubs = []
            this.timeouts.push(
              setTimeout(() => {
                if (this.subs[id]) {
                  this.log.info('[%s] UPDATE origin subscription %s due error %s', chainId, id, errorMessage(error))
                  const { subs: updated, controls } = this.#monitorOrigins(descriptor, args)
                  this.subs[id].sendersControl = controls.sendersControl
                  this.subs[id].messageControl = controls.messageControl
                  this.subs[id].originSubs = updated
                }
              }, SUB_ERROR_RETRY_MS)
            )
          }
        }
      },
    }

    try {
      if (this.ingress.isRelay(chainId)) {
        // VMP DMP
        this.log.info('[%s] subscribe outbound DMP (%s)', chainId, id)

        subs.push({
          chainId,
          sub: this.ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.sharedBlockExtrinsics(chainId).pipe(
                  extractDmpSend(chainId, this.#getDmp(chainId, registry), registry),
                  this.#emitOutbound(id, chainId, registry, messageControl)
                )
              )
            )
            .subscribe(outboundObserver),
        })

        // VMP DMP
        this.log.info('[%s] subscribe outbound DMP - by event (%s)', chainId, id)

        subs.push({
          chainId,
          sub: this.ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.sharedBlockEvents(chainId).pipe(
                  extractDmpSendByEvent(chainId, this.#getDmp(chainId, registry), registry),
                  this.#emitOutbound(id, chainId, registry, messageControl)
                )
              )
            )
            .subscribe(outboundObserver),
        })
      } else {
        // Outbound HRMP / XCMP transport
        this.log.info('[%s] subscribe outbound HRMP (%s)', chainId, id)

        subs.push({
          chainId,
          sub: this.ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.sharedBlockEvents(chainId).pipe(
                  extractXcmpSend(chainId, this.#getHrmp(chainId, registry), registry),
                  this.#emitOutbound(id, chainId, registry, messageControl)
                )
              )
            )
            .subscribe(outboundObserver),
        })

        // VMP UMP
        this.log.info('[%s] subscribe outbound UMP (%s)', chainId, id)

        subs.push({
          chainId,
          sub: this.ingress
            .getRegistry(chainId)
            .pipe(
              switchMap((registry) =>
                this.sharedBlockEvents(chainId).pipe(
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
      subs,
      controls: {
        sendersControl,
        messageControl,
      },
    }
  }

  #monitorRelay({ id }: Subscription, { origin, destinations }: XCMSubscriptionArgs) {
    const chainId = origin as NetworkURN
    if (this.subs[id]?.relaySub) {
      this.log.debug('Relay subscription already exists.')
    }
    const messageControl = ControlQuery.from(messageCriteria(destinations as NetworkURN[]))

    const emitRelayInbound = () => (source: Observable<XcmRelayedWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onRelayedMessage(id, message))))

    const relayObserver = {
      error: (error: any) => {
        this.log.error(error, '[%s] error on relay subscription s', chainId, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId,
          direction: 'relay',
        })

        // try recover relay subscription
        // there is only one subscription per subscription ID for relay
        if (this.subs[id]) {
          const sub = this.subs[id]
          this.timeouts.push(
            setTimeout(async () => {
              this.log.info('[%s] UPDATE relay subscription %s due error %s', chainId, id, errorMessage(error))
              const updatedSub = await this.#monitorRelay(sub.descriptor, sub.args)
              sub.relaySub = updatedSub
            }, SUB_ERROR_RETRY_MS)
          )
        }
      },
    }

    // TODO: should resolve relay id for consensus in context
    const relayIds = this.ingress.getRelayIds()
    const relayId = relayIds.find((r) => getConsensus(r) === getConsensus(chainId))

    if (relayId === undefined) {
      throw new Error(`No relay ID found for chain ${chainId}`)
    }
    this.log.info('[%s] subscribe relay %s xcm events (%s)', chainId, relayId, id)
    return {
      chainId,
      sub: this.ingress
        .getRegistry(relayId)
        .pipe(
          switchMap((registry) =>
            this.sharedBlockExtrinsics(relayId).pipe(
              extractRelayReceive(chainId, messageControl, registry),
              emitRelayInbound()
            )
          )
        )
        .subscribe(relayObserver),
    }
  }

  // Assumes only 1 pair of bridge hub origin-destination is possible
  // TODO: handle possible multiple different consensus utilizing PK bridge e.g. solochains?
  #monitorPkBridge({ id }: Subscription, { origin, destinations }: XCMSubscriptionArgs) {
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

    if (this.subs[id]?.bridgeSubs.find((s) => s.type === 'pk-bridge')) {
      throw new Error(`Fatal: duplicated PK bridge monitor ${id}`)
    }

    const type: BridgeType = 'pk-bridge'

    const emitBridgeOutboundAccepted = () => (source: Observable<XcmBridgeAcceptedWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeOutboundAccepted(id, message))))

    const emitBridgeOutboundDelivered = () => (source: Observable<XcmBridgeDeliveredWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeOutboundDelivered(id, message))))

    const emitBridgeInbound = () => (source: Observable<XcmBridgeInboundWithContext>) =>
      source.pipe(switchMap((message) => from(this.#engine.onBridgeInbound(id, message))))

    const pkBridgeObserver = {
      error: (error: any) => {
        this.log.error(error, '[%s] error on PK bridge subscription s', originBridgeHub, id)
        this.#telemetry.emit('telemetryXcmSubscriptionError', {
          subscriptionId: id,
          chainId: originBridgeHub,
          direction: 'bridge',
        })

        // try recover pk bridge subscription
        if (this.subs[id]) {
          const sub = this.subs[id]
          const { bridgeSubs } = sub
          const index = bridgeSubs.findIndex((s) => s.type === 'pk-bridge')
          if (index > -1) {
            bridgeSubs.splice(index, 1)
            this.timeouts.push(
              setTimeout(() => {
                this.log.info(
                  '[%s] UPDATE destination subscription %s due error %s',
                  originBridgeHub,
                  id,
                  errorMessage(error)
                )
                bridgeSubs.push(this.#monitorPkBridge(sub.descriptor, sub.args))
                sub.bridgeSubs = bridgeSubs
              }, SUB_ERROR_RETRY_MS)
            )
          }
        }
      },
    }

    this.log.info(
      '[%s] subscribe PK bridge outbound accepted events on bridge hub %s (%s)',
      origin,
      originBridgeHub,
      id
    )
    const outboundAccepted: RxSubscriptionWithId = {
      chainId: originBridgeHub,
      sub: this.ingress
        .getRegistry(originBridgeHub)
        .pipe(
          switchMap((registry) =>
            this.sharedBlockEvents(originBridgeHub).pipe(
              extractBridgeMessageAccepted(originBridgeHub, registry, this.getStorageAt(originBridgeHub)),
              emitBridgeOutboundAccepted()
            )
          )
        )
        .subscribe(pkBridgeObserver),
    }

    this.log.info(
      '[%s] subscribe PK bridge outbound delivered events on bridge hub %s (%s)',
      origin,
      originBridgeHub,
      id
    )
    const outboundDelivered: RxSubscriptionWithId = {
      chainId: originBridgeHub,
      sub: this.ingress
        .getRegistry(originBridgeHub)
        .pipe(
          switchMap((registry) =>
            this.sharedBlockEvents(originBridgeHub).pipe(
              extractBridgeMessageDelivered(originBridgeHub, registry),
              emitBridgeOutboundDelivered()
            )
          )
        )
        .subscribe(pkBridgeObserver),
    }

    this.log.info('[%s] subscribe PK bridge inbound events on bridge hub %s (%s)', origin, destBridgeHub, id)
    const inbound: RxSubscriptionWithId = {
      chainId: destBridgeHub,
      sub: this.sharedBlockEvents(destBridgeHub)
        .pipe(extractBridgeReceive(destBridgeHub), emitBridgeInbound())
        .subscribe(pkBridgeObserver),
    }

    return {
      type,
      subs: [outboundAccepted, outboundDelivered, inbound],
    }
  }

  #updateDestinationSubscriptions(id: string) {
    const { descriptor, args, destinationSubs } = this.subs[id]
    // Subscribe to new destinations, if any
    const { subs } = this.#monitorDestinations(descriptor, args)
    const updatedSubs = destinationSubs.concat(subs)
    // Unsubscribe removed destinations, if any
    const removed = updatedSubs.filter((s) => !args.destinations.includes(s.chainId))
    removed.forEach(({ sub }) => sub.unsubscribe())
    // Return list of updated subscriptions
    return updatedSubs.filter((s) => !removed.includes(s))
  }

  /**
   * Starts collecting XCM messages.
   *
   * Monitors all the active subscriptions.
   *
   * @private
   */
  async #startNetworkMonitors() {
    const subs = await this.db.getByAgentId(this.id)

    this.log.info('[%s] subscriptions %d', this.id, subs.length)

    for (const sub of subs) {
      try {
        this.#monitor(sub, $XCMSubscriptionArgs.parse(sub.args))
      } catch (err) {
        this.log.error(err, 'Unable to create subscription: %j', sub)
      }
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
   * @param Subscription
   * @returns boolean
   */
  #shouldMonitorRelay({ origin, destinations, events }: XCMSubscriptionArgs) {
    return (
      (events === undefined || events === '*' || events.includes(XcmNotificationType.Relayed)) &&
      !this.ingress.isRelay(origin as NetworkURN) &&
      destinations.some((d) => !this.ingress.isRelay(d as NetworkURN))
    )
  }

  #emitInbound(id: string, chainId: NetworkURN) {
    return (source: Observable<XcmInboundWithContext>) =>
      source.pipe(switchMap((msg) => from(this.#engine.onInboundMessage(new XcmInbound(id, chainId, msg)))))
  }

  #emitOutbound(id: string, origin: NetworkURN, registry: Registry, messageControl: ControlQuery) {
    const {
      args: { outboundTTL },
    } = this.subs[id]

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
      return from(this.ingress.getStorage(chainId, dmpDownwardMessageQueuesKey(registry, paraId), blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<PolkadotCorePrimitivesInboundDownwardMessage>', buffer)
        })
      )
    }
  }

  #getUmp(chainId: NetworkURN, registry: Registry): GetOutboundUmpMessages {
    return (blockHash: HexString) => {
      return from(this.ingress.getStorage(chainId, parachainSystemUpwardMessages, blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<Bytes>', buffer)
        })
      )
    }
  }

  #getHrmp(chainId: NetworkURN, registry: Registry): GetOutboundHrmpMessages {
    return (blockHash: HexString) => {
      return from(this.ingress.getStorage(chainId, parachainSystemHrmpOutboundMessages, blockHash)).pipe(
        map((buffer) => {
          return registry.createType('Vec<PolkadotCorePrimitivesOutboundHrmpMessage>', buffer)
        })
      )
    }
  }

  /**
   * Updates the senders control handler.
   *
   * Applies to the outbound extrinsic signers.
   */
  #updateSenders(id: string) {
    const {
      args: { senders },
      sendersControl,
    } = this.subs[id]

    sendersControl.change(sendersCriteria(senders))
  }

  /**
   * Updates the message control handler.
   *
   * Updates the destination subscriptions.
   */
  #updateDestinations(id: string) {
    const { args, messageControl } = this.subs[id]

    messageControl.change(messageCriteria(args.destinations as NetworkURN[]))

    const updatedSubs = this.#updateDestinationSubscriptions(id)
    this.subs[id].destinationSubs = updatedSubs
  }

  /**
   * Updates the subscription to relayed HRMP messages in the relay chain.
   */
  #updateEvents(id: string) {
    const { descriptor, args, relaySub } = this.subs[id]

    if (this.#shouldMonitorRelay(args) && relaySub === undefined) {
      try {
        this.subs[id].relaySub = this.#monitorRelay(descriptor, args)
      } catch (error) {
        // log instead of throw to not block OD subscriptions
        this.log.error(error, 'Error on relay subscription (%s)', id)
      }
    } else if (!this.#shouldMonitorRelay(args) && relaySub !== undefined) {
      relaySub.sub.unsubscribe()
      delete this.subs[id].relaySub
    }
  }

  #updateDescriptor(sub: Subscription) {
    if (this.subs[sub.id]) {
      this.subs[sub.id].descriptor = sub
    } else {
      this.log.warn('trying to update an unknown subscription %s', sub.id)
    }
  }

  #validateChainIds(chainIds: NetworkURN[]) {
    chainIds.forEach((chainId) => {
      if (!this.ingress.isNetworkDefined(chainId)) {
        throw new ValidationError('Invalid chain id:' + chainId)
      }
    })
  }
}

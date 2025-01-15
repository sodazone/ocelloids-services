import EventEmitter from 'node:events'

import { ControlQuery } from '@/common/rx/index.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { HexString, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'

import { Subject, from, map, share, switchMap } from 'rxjs'
import { AgentRuntimeContext } from '../types.js'
import { MatchingEngine } from './matching.js'
import { mapXcmInbound, mapXcmSent } from './ops/common.js'
import { messageCriteria } from './ops/criteria.js'
import { extractDmpReceiveByBlock, extractDmpSendByEvent } from './ops/dmp.js'
import { extractRelayReceive } from './ops/relay.js'
import { extractUmpReceive, extractUmpSend } from './ops/ump.js'
import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js'
import { TelemetryXcmEventEmitter } from './telemetry/events.js'
import { xcmAgentMetrics, xcmMatchingEngineMetrics } from './telemetry/metrics.js'
import {
  GetDownwardMessageQueues,
  GetOutboundHrmpMessages,
  GetOutboundUmpMessages,
  XcmInbound,
  XcmMessagePayload,
  XcmRelayedWithContext,
  XcmSent,
} from './types.js'

const EXCLUDED_NETWORKS: NetworkURN[] = []

export class XcmTracker {
  readonly #id = 'xcm-tracker'
  readonly #log: Logger

  readonly #streams: {
    d: RxSubscriptionWithId[]
    o: RxSubscriptionWithId[]
    r: RxSubscriptionWithId[]
  }
  readonly #telemetry: TelemetryXcmEventEmitter
  readonly #ingress: SubstrateIngressConsumer
  readonly #shared: SubstrateSharedStreams
  readonly #engine: MatchingEngine
  readonly #subject: Subject<XcmMessagePayload>

  readonly xcm$

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log

    this.#subject = new Subject<XcmMessagePayload>()
    this.xcm$ = this.#subject.pipe(share())

    this.#streams = { d: [], o: [], r: [] }
    this.#ingress = ctx.ingress.substrate
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#telemetry = new (EventEmitter as new () => TelemetryXcmEventEmitter)()
    this.#engine = new MatchingEngine(ctx, (msg: XcmMessagePayload) => this.#subject.next(msg))
  }

  start() {
    const chainsToTrack = this.#ingress.getChainIds().filter((c) => !EXCLUDED_NETWORKS.includes(c))

    this.#log.info('[%s] start (%s)', this.#id, chainsToTrack)

    this.#monitorOrigins(chainsToTrack)
    this.#monitorDestinations(chainsToTrack)
    this.#monitorRelays(chainsToTrack)
  }

  async stop() {
    this.#log.info('[%s] stop', this.#id)

    Object.values(this.#streams).forEach((streams) => streams.forEach(({ sub }) => sub.unsubscribe()))

    await this.#engine.stop()
  }

  collectTelemetry() {
    xcmMatchingEngineMetrics(this.#engine)
    xcmAgentMetrics(this.#telemetry)
  }

  /**
   * Set up inbound monitors for XCM protocols.
   *
   * @private
   */
  #monitorDestinations(chains: NetworkURN[]) {
    const subs: RxSubscriptionWithId[] = []
    try {
      for (const chainId of chains) {
        if (this.#isTracking('d', chainId)) {
          // Skip existing streams
          // for the same destination chain
          continue
        }

        const inboundObserver = {
          error: (error: any) => {
            this.#log.error(error, '[%s] %s error on destination stream', this.#id, chainId)

            this.#telemetry.emit('telemetryXcmSubscriptionError', {
              chainId,
              direction: 'in',
            })
          },
          next: (msg: XcmInbound) => this.#engine.onInboundMessage(msg),
        }

        if (this.#ingress.isRelay(chainId)) {
          // VMP UMP
          this.#log.info('[%s] %s subscribe inbound UMP', this.#id, chainId)

          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractUmpReceive(), mapXcmInbound(chainId))
              .subscribe(inboundObserver),
          })
        } else {
          // VMP DMP
          this.#log.info('[%s] %s subscribe inbound DMP', this.#id, chainId)

          subs.push({
            chainId,
            sub: this.#ingress
              .finalizedBlocks(chainId)
              .pipe(extractDmpReceiveByBlock(), mapXcmInbound(chainId))
              .subscribe(inboundObserver),
          })

          // Inbound HRMP / XCMP transport
          this.#log.info('[%s] %s subscribe inbound HRMP', this.#id, chainId)

          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractXcmpReceive(), mapXcmInbound(chainId))
              .subscribe(inboundObserver),
          })
        }
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.d = subs
  }

  /**
   * Set up outbound monitors for XCM protocols.
   *
   * @private
   */
  #monitorOrigins(chains: NetworkURN[]) {
    const subs: RxSubscriptionWithId[] = []

    for (const chainId of chains) {
      if (this.#isTracking('o', chainId)) {
        continue
      }

      const outboundObserver = {
        error: (error: any) => {
          this.#log.error(error, '[%s] %s error on origin stream', this.#id, chainId)
          this.#telemetry.emit('telemetryXcmSubscriptionError', {
            chainId,
            direction: 'out',
          })
        },
        next: (msg: XcmSent) => this.#engine.onOutboundMessage(msg),
      }

      try {
        if (this.#ingress.isRelay(chainId)) {
          // VMP DMP
          this.#log.info('[%s] %s subscribe outbound DMP', this.#id, chainId)

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
                      mapXcmSent(context, chainId),
                    ),
                ),
              )
              .subscribe(outboundObserver),
          })
        } else {
          // Outbound HRMP / XCMP transport
          this.#log.info('[%s] %s subscribe outbound HRMP', this.#id, chainId)

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
                      mapXcmSent(context, chainId),
                    ),
                ),
              )
              .subscribe(outboundObserver),
          })

          // VMP UMP
          this.#log.info('[%s] %s subscribe outbound UMP', this.#id, chainId)

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
                      mapXcmSent(context, chainId),
                    ),
                ),
              )
              .subscribe(outboundObserver),
          })
        }
      } catch (error) {
        /* c8 ignore next */
        // Clean up streams.
        subs.forEach(({ sub }) => {
          sub.unsubscribe()
        })
        /* c8 ignore next */
        throw error
      }
    }

    this.#streams.o = subs
  }

  #monitorRelays(chains: NetworkURN[]) {
    const messageControl = ControlQuery.from(messageCriteria(chains as NetworkURN[]))

    for (const chainId of chains) {
      if (this.#ingress.isRelay(chainId)) {
        continue
      }
      //const emitRelayInbound = () => (source: Observable<XcmRelayedWithContext>) =>
      //  source.pipe(switchMap((message) => from(this.#cb.onRelayed(message))))

      const relayObserver = {
        error: (error: any) => {
          this.#log.error(error, '[%s] %s error on relay stream', this.#id, chainId)
          this.#telemetry.emit('telemetryXcmSubscriptionError', {
            chainId,
            direction: 'relay',
          })
        },
        next: (msg: XcmRelayedWithContext) => this.#engine.onRelayedMessage(msg),
      }

      // TODO: should resolve relay id for consensus in context
      const relayIds = this.#ingress.getRelayIds()
      const relayId = relayIds.find((r) => getConsensus(r) === getConsensus(chainId))

      if (relayId === undefined) {
        throw new Error(`No relay ID found for chain ${chainId}`)
      }

      if (this.#isTracking('r', chainId)) {
        this.#log.debug('Relay stream already exists.')
        continue
      }

      this.#log.info('[%s] %s subscribe relay %s xcm events', this.#id, chainId, relayId)

      this.#streams.r.push({
        chainId,
        sub: this.#ingress
          .getContext(relayId)
          .pipe(
            switchMap((context) =>
              this.#shared
                .blockExtrinsics(relayId)
                .pipe(extractRelayReceive(chainId, messageControl, context)),
            ),
          )
          .subscribe(relayObserver),
      })
    }
  }

  #isTracking(type: 'd' | 'o' | 'r', chainId: NetworkURN) {
    return this.#streams[type].findIndex((s) => s.chainId === chainId) > -1
  }

  #getDmp(chainId: NetworkURN, context: SubstrateApiContext): GetDownwardMessageQueues {
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

  #getUmp(chainId: NetworkURN, context: SubstrateApiContext): GetOutboundUmpMessages {
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

  #getHrmp(chainId: NetworkURN, context: SubstrateApiContext): GetOutboundHrmpMessages {
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
}

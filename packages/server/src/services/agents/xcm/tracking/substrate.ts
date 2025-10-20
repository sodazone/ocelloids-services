import EventEmitter from 'node:events'
import { FixedSizeBinary } from '@polkadot-api/substrate-bindings'
import { fromHex, toHex } from 'polkadot-api/utils'
import { concatMap, from, map, Observable, switchMap } from 'rxjs'

import { ControlQuery } from '@/common/rx/index.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { HexString, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../../types.js'
import { extractParachainReceiveByBlock, mapXcmInbound, mapXcmSent } from '../ops/common.js'
import { messageCriteria } from '../ops/criteria.js'
import { extractDmpSendByEvent, extractDmpSendByTx } from '../ops/dmp.js'
import {
  extractBridgeMessageAccepted,
  extractBridgeReceive,
  PkBridgeConfig,
  pkBridgeConfig,
} from '../ops/pk-bridge.js'
import { extractRelayReceive } from '../ops/relay.js'
import { extractUmpReceive, extractUmpSend } from '../ops/ump.js'
import { getMessageId, matchExtrinsic } from '../ops/util.js'
import { fromXcmpFormat, raw } from '../ops/xcm-format.js'
import { extractXcmpSend } from '../ops/xcmp.js'
import { TelemetryXcmEventEmitter } from '../telemetry/events.js'
import { xcmAgentMetrics } from '../telemetry/metrics.js'
import {
  GetDownwardMessageQueues,
  GetOutboundHrmpMessages,
  GetOutboundPKBridgeMessages,
  GetOutboundUmpMessages,
  MessageHashData,
  XcmInbound,
  XcmRelayedWithContext,
  XcmSent,
} from '../types/index.js'
import { MatchingEngine } from './matching.js'

const EXCLUDED_NETWORKS: NetworkURN[] = []

type DmpInQueue = { msg: HexString; sent_at: number }
type HrmpInQueue = { data: HexString; sent_at: number }
type HorizontalMessage = [number, HrmpInQueue[]]
type AbridgedHorizontalMessage = [number, HrmpInQueue]
type ParachainValidationData =
  | {
      data: {
        downward_messages: DmpInQueue[]
        horizontal_messages: HorizontalMessage[]
      }
    }
  | {
      inbound_messages_data: {
        downward_messages: { full_messages: DmpInQueue[] }
        horizontal_messages: { full_messages: AbridgedHorizontalMessage[] }
      }
    }

export function extractXcmMessageData(apiContext: SubstrateApiContext) {
  return (source: Observable<Block>): Observable<{ block: Block; hashData: MessageHashData[] }> => {
    return source.pipe(
      map((block) => {
        const paraExtrinsic = block.extrinsics.find((ext) =>
          matchExtrinsic(ext, 'ParachainSystem', 'set_validation_data'),
        )
        if (!paraExtrinsic) {
          return { block, hashData: [] }
        }

        const args = paraExtrinsic.args as ParachainValidationData

        const downwardMessages: DmpInQueue[] =
          'inbound_messages_data' in args
            ? args.inbound_messages_data.downward_messages.full_messages
            : args.data.downward_messages

        const horizontalMessages: HrmpInQueue[] =
          'inbound_messages_data' in args
            ? args.inbound_messages_data.horizontal_messages.full_messages.map(([, msg]) => msg)
            : args.data.horizontal_messages.flatMap(([, msgs]) => msgs)

        const messages: MessageHashData[] = horizontalMessages.flatMap((m) => {
          const xcms = fromXcmpFormat(fromHex(m.data), apiContext)
          return xcms.map((xcm) => ({
            hash: xcm.hash,
            data: toHex(xcm.data) as HexString,
            topicId: getMessageId(xcm),
          }))
        })

        const dmpMessages: MessageHashData[] = downwardMessages.map((dm) => {
          const decoded = raw.asVersionedXcm(dm.msg, apiContext)
          return { hash: decoded.hash, data: dm.msg, topicId: getMessageId(decoded) }
        })

        return {
          block,
          hashData: [...messages, ...dmpMessages],
        }
      }),
    )
  }
}

export class SubstrateXcmTracker {
  readonly #id = 'substrate-xcm-tracker'
  readonly #log: Logger

  readonly #streams: {
    d: RxSubscriptionWithId[]
    o: RxSubscriptionWithId[]
    r: RxSubscriptionWithId[]
    b: RxSubscriptionWithId[]
  }
  readonly #telemetry: TelemetryXcmEventEmitter
  readonly #ingress: SubstrateIngressConsumer
  readonly #shared: SubstrateSharedStreams
  readonly #engine: MatchingEngine

  constructor(ctx: AgentRuntimeContext, engine: MatchingEngine) {
    this.#log = ctx.log

    this.#streams = { d: [], o: [], r: [], b: [] }
    this.#ingress = ctx.ingress.substrate
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#telemetry = new (EventEmitter as new () => TelemetryXcmEventEmitter)()
    this.#engine = engine
  }

  start() {
    const chainsToTrack = this.#ingress.getChainIds().filter((c) => !EXCLUDED_NETWORKS.includes(c))
    this.#log.info('[%s] start (%s)', this.#id, chainsToTrack)

    this.#monitorOrigins(chainsToTrack)
    this.#monitorDestinations(chainsToTrack)
    this.#monitorRelays(chainsToTrack)
    this.#monitorPkBridge(chainsToTrack)
  }

  stop() {
    this.#log.info('[%s] stop', this.#id)
    Object.values(this.#streams).forEach((streams) => streams.forEach(({ sub }) => sub.unsubscribe()))
  }

  collectTelemetry() {
    xcmAgentMetrics(this.#telemetry)
  }

  #monitorDestinations(chains: NetworkURN[]) {
    if (this.#streams.d.length > 0) {
      throw new Error('Destination streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    try {
      for (const chainId of chains) {
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
            id: chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(extractUmpReceive(), mapXcmInbound(chainId))
              .subscribe(inboundObserver),
          })
        } else {
          // VMP + HRMP
          this.#log.info('[%s] %s subscribe inbound DMP + HRMP / XCMP', this.#id, chainId)

          const messageHashBlocks$ = this.#ingress.getContext(chainId).pipe(
            switchMap((context) =>
              this.#shared.blocks(chainId).pipe(
                extractXcmMessageData(context),
                concatMap(async ({ block, hashData }) => {
                  for (const h of hashData) {
                    await this.#engine.onMessageData(h)
                  }
                  return block
                }),
              ),
            ),
          )

          // Extract both DMP and HRMP receive
          subs.push({
            id: chainId,
            sub: messageHashBlocks$
              .pipe(extractParachainReceiveByBlock(chainId), mapXcmInbound(chainId))
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

  #monitorOrigins(chains: NetworkURN[]) {
    if (this.#streams.o.length > 0) {
      throw new Error('Origin streams already open')
    }

    const subs: RxSubscriptionWithId[] = []
    const canBeMatched = ({ destination }: XcmSent) => chains.includes(destination.chainId)

    try {
      for (const chainId of chains) {
        const outboundObserver = {
          error: (error: any) => {
            this.#log.error(error, '[%s] %s error on origin stream', this.#id, chainId)
            this.#telemetry.emit('telemetryXcmSubscriptionError', {
              chainId,
              direction: 'out',
            })
          },
          next: (msg: XcmSent) => {
            if (canBeMatched(msg)) {
              this.#engine.onOutboundMessage(msg)
            }
          },
        }

        if (this.#ingress.isRelay(chainId)) {
          // VMP DMP
          this.#log.info('[%s] %s subscribe outbound DMP', this.#id, chainId)

          subs.push({
            id: chainId,
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

          subs.push({
            id: chainId,
            sub: this.#ingress
              .getContext(chainId)
              .pipe(
                switchMap((context) =>
                  this.#shared
                    .blockExtrinsics(chainId)
                    .pipe(
                      extractDmpSendByTx(chainId, this.#getDmp(chainId, context), context),
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
            id: chainId,
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
            id: chainId,
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
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.o = subs
  }

  #monitorRelays(chains: NetworkURN[]) {
    const messageControl = ControlQuery.from(messageCriteria(chains as NetworkURN[]))

    for (const chainId of chains) {
      if (this.#ingress.isRelay(chainId)) {
        continue
      }

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
        id: chainId,
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

  #monitorPkBridge(chains: NetworkURN[]) {
    if (this.#streams.b.length > 0) {
      throw new Error('Bridge streams already open')
    }

    const subs: RxSubscriptionWithId[] = []
    try {
      for (const [chainId, config] of Object.entries(pkBridgeConfig) as [NetworkURN, PkBridgeConfig][]) {
        const { destination } = config

        if (!chains.includes(chainId) || !chains.includes(destination)) {
          continue
        }

        const pkBridgeErrorHandler = (error: any) => {
          this.#log.error(error, '[%s] %s error on pk-bridge stream', this.#id, chainId)
          this.#telemetry.emit('telemetryXcmSubscriptionError', {
            chainId,
            direction: 'bridge',
          })
        }

        this.#log.info('[%s] %s subscribe PK bridge outbound accepted events', this.#id, chainId)
        subs.push({
          id: `${chainId}:accepted`,
          sub: this.#ingress
            .getContext(chainId)
            .pipe(
              switchMap((context) =>
                this.#shared
                  .blockEvents(chainId)
                  .pipe(extractBridgeMessageAccepted(chainId, this.#getPkBridge(chainId, context), context)),
              ),
            )
            .subscribe({
              next: (message) => this.#engine.onBridgeOutboundAccepted(message),
              error: pkBridgeErrorHandler,
            }),
        })

        this.#log.info('[%s] %s subscribe PK bridge received events', this.#id, destination)
        subs.push({
          id: `${destination}:received`,
          sub: this.#shared
            .blockEvents(destination)
            .pipe(extractBridgeReceive(destination))
            .subscribe({
              next: (message) => this.#engine.onBridgeInbound(message),
              error: pkBridgeErrorHandler,
            }),
        })
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.b = subs
  }

  #isTracking(type: 'd' | 'o' | 'r' | 'b', id: string) {
    return this.#streams[type].findIndex((s) => s.id === id) > -1
  }

  #getPkBridge(chainId: NetworkURN, context: SubstrateApiContext): GetOutboundPKBridgeMessages {
    const config = pkBridgeConfig[chainId]
    const codec = context.storageCodec(config.pallet, 'OutboundMessages')
    return (blockHash: HexString, lane: HexString, nonce: number) => {
      const key = codec.keys.enc({
        lane_id: new FixedSizeBinary(fromHex(lane)),
        nonce: BigInt(nonce),
      }) as HexString
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.value.dec(buffer)
        }),
      )
    }
  }

  #getDmp(chainId: NetworkURN, context: SubstrateApiContext): GetDownwardMessageQueues {
    const codec = context.storageCodec('Dmp', 'DownwardMessageQueues')
    return (blockHash: HexString, networkId: NetworkURN) => {
      const paraId = getChainId(networkId)
      const key = codec.keys.enc(paraId) as HexString
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.value.dec(buffer)
        }),
      )
    }
  }

  #getUmp(chainId: NetworkURN, context: SubstrateApiContext): GetOutboundUmpMessages {
    const codec = context.storageCodec('ParachainSystem', 'UpwardMessages')
    const key = codec.keys.enc() as HexString
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.value.dec(buffer)
        }),
      )
    }
  }

  #getHrmp(chainId: NetworkURN, context: SubstrateApiContext): GetOutboundHrmpMessages {
    const codec = context.storageCodec('ParachainSystem', 'HrmpOutboundMessages')
    const key = codec.keys.enc() as HexString
    return (blockHash: HexString) => {
      return from(this.#ingress.getStorage(chainId, key, blockHash)).pipe(
        map((buffer) => {
          return codec.value.dec(buffer)
        }),
      )
    }
  }
}

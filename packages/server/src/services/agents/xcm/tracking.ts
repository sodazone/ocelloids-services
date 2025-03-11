import EventEmitter from 'node:events'
import { fromHex, toHex } from 'polkadot-api/utils'
import { Observable, Subject, concatMap, from, map, share, switchMap } from 'rxjs'

import { ControlQuery } from '@/common/rx/index.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { extractEvents } from '@/services/networking/substrate/rx/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { HexString, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'

import { ArchiveRepository } from '@/services/archive/repository.js'
import { HistoricalQuery } from '@/services/archive/types.js'
import { AgentRuntimeContext } from '../types.js'
import { MatchingEngine } from './matching.js'
import { mapXcmInbound, mapXcmSent } from './ops/common.js'
import { extractParachainReceive } from './ops/common.js'
import { messageCriteria } from './ops/criteria.js'
import { extractDmpSendByEvent } from './ops/dmp.js'
import { extractRelayReceive } from './ops/relay.js'
import { extractUmpReceive, extractUmpSend } from './ops/ump.js'
import { getMessageId, matchExtrinsic } from './ops/util.js'
import { fromXcmpFormat, raw } from './ops/xcm-format.js'
import { extractXcmpSend } from './ops/xcmp.js'
import { TelemetryXcmEventEmitter } from './telemetry/events.js'
import { xcmAgentMetrics, xcmMatchingEngineMetrics } from './telemetry/metrics.js'
import {
  GetDownwardMessageQueues,
  GetOutboundHrmpMessages,
  GetOutboundUmpMessages,
  MessageHashData,
  XcmInbound,
  XcmMessagePayload,
  XcmRelayedWithContext,
  XcmSent,
} from './types.js'

const EXCLUDED_NETWORKS: NetworkURN[] = []

type DmpInQueue = { msg: HexString; sent_at: number }
type HrmpInQueue = { data: HexString; sent_at: number }
type HorizontalMessage = [number, HrmpInQueue[]]

export function extractXcmMessageData(apiContext: SubstrateApiContext) {
  return (source: Observable<Block>): Observable<{ block: Block; hashData: MessageHashData[] }> => {
    return source.pipe(
      map((block) => {
        const paraExtrinsic = block.extrinsics.find((ext) =>
          matchExtrinsic(ext, 'ParachainSystem', 'set_validation_data'),
        )
        if (paraExtrinsic) {
          // extract dmp and hrmp messages from params
          const {
            data: { downward_messages, horizontal_messages },
          } = paraExtrinsic.args as {
            data: {
              downward_messages: DmpInQueue[]
              horizontal_messages: HorizontalMessage[]
            }
          }
          const messages = horizontal_messages.reduce((acc: MessageHashData[], h) => {
            const [_chain, msgs] = h
            for (const m of msgs) {
              const xcms = fromXcmpFormat(fromHex(m.data), apiContext)
              for (const xcm of xcms) {
                acc.push({ hash: xcm.hash, data: toHex(xcm.data) as HexString, topicId: getMessageId(xcm) })
              }
            }
            return acc
          }, [])

          const dmpMessages = downward_messages.map((dm) => {
            const decoded = raw.asVersionedXcm(dm.msg, apiContext)
            return { hash: decoded.hash, data: dm.msg, topicId: getMessageId(decoded) }
          })

          return {
            block,
            hashData: messages.concat(dmpMessages),
          }
        }
        return {
          block,
          hashData: [],
        }
      }),
    )
  }
}
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
  readonly #archive: ArchiveRepository

  readonly xcm$

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log

    this.#subject = new Subject<XcmMessagePayload>()
    this.xcm$ = this.#subject.pipe(share())

    this.#streams = { d: [], o: [], r: [] }
    this.#ingress = ctx.ingress.substrate
    this.#archive = ctx.archive
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

    // TODO configurable
    this.#storeHistoricalData()
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

  historicalXcm$(query: Partial<HistoricalQuery>) {
    return this.#archive.withHistory(this.xcm$, query)
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
            chainId,
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
            chainId,
            sub: messageHashBlocks$
              .pipe(extractEvents(), extractParachainReceive(), mapXcmInbound(chainId))
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

  #storeHistoricalData() {
    this.#log.info('[%s] Tracking historical events', this.#id)

    this.xcm$.subscribe(async (message) => {
      await this.#archive.insertLogs({
        network: message.waypoint.chainId,
        agent: 'xcm',
        block_number: Number(message.waypoint.blockNumber),
        payload: JSON.stringify(message),
      })
    })
  }
}

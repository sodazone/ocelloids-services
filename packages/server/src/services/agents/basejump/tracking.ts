import { catchError, EMPTY, from, mergeMap, of, Subject, share } from 'rxjs'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { getConsensus } from '@/services/config.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { retryCapped } from '@/services/networking/watcher.js'
import { HexString, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { networks } from '../common/networks.js'
import { AgentRuntimeContext } from '../types.js'
import { CONFIG } from './config.js'
import { BasejumpMatchingEngine } from './matching.js'
import { extractBasejumpLanding } from './ops/destination.js'
import { extractBasejumpEvmOutbound } from './ops/origin.js'
import { extractBasejumpProxy } from './ops/relay.js'
import {
  BasejumpInitiated,
  BasejumpInitiatedWithContext,
  BasejumpLandedWithContext,
  BasejumpMessagePayload,
  BasejumpRelayedWithContext,
} from './types.js'

export class BasejumpTracker {
  readonly #id = 'basejump-tracker'
  readonly #log: Logger
  readonly #ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
  readonly #shared: SubstrateSharedStreams
  readonly #engine: BasejumpMatchingEngine
  readonly #subject: Subject<BasejumpMessagePayload>

  readonly #streams: {
    o: RxSubscriptionWithId[]
    r: RxSubscriptionWithId[]
    d: RxSubscriptionWithId[]
  } = { o: [], r: [], d: [] }

  readonly basejump$

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = {
      evm: ctx.ingress.evm,
      substrate: ctx.ingress.substrate,
    }
    this.#shared = SubstrateSharedStreams.instance(this.#ingress.substrate)

    this.#subject = new Subject<BasejumpMessagePayload>()
    this.basejump$ = this.#subject.asObservable().pipe(share())

    this.#engine = new BasejumpMatchingEngine(ctx, (msg: BasejumpMessagePayload) => this.#subject.next(msg))
  }

  async start() {
    this.#log.info('[agent:%s] wait APIs ready', this.#id)
    await this.#ingress.substrate.isReady()

    this.#monitorOrigins()
    this.#monitorRelays()
    this.#monitorDestinations()
    this.#log.info('[agent:%s] started', this.#id)
  }

  stop() {
    Object.values(this.#streams).forEach((streams) => streams.forEach(({ sub }) => sub.unsubscribe()))
    this.#log.info('[%s] stopped', this.#id)
  }

  #monitorOrigins() {
    if (this.#streams.o.length > 0) {
      throw new Error('Origin streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    for (const [network, contractAddress] of Object.entries(CONFIG.origin)) {
      const networkId = network as NetworkURN
      const consensus = getConsensus(networkId)
      if (consensus === 'ethereum') {
        subs.push({
          id: `${networkId}.out`,
          sub: this.#ingress.evm
            .finalizedBlocks(networkId)
            .pipe(
              mergeMap((block) => {
                return from(this.#ingress.evm.getLogs(networkId, block.number)).pipe(
                  retryWithTruncatedExpBackoff(retryCapped(3)),
                  mergeMap((logs) =>
                    of({
                      ...block,
                      logs,
                    }),
                  ),
                  catchError((error) => {
                    this.#log.error(
                      error,
                      '[%s] %s failed to fetch logs for block #%s. Continuing stream...',
                      this.#id,
                      networkId,
                      block.number,
                    )

                    return EMPTY
                  }),
                )
              }),
              extractBasejumpEvmOutbound(networkId, contractAddress, (txHash: HexString) =>
                this.#ingress.evm.getTransactionReceipt(networkId, txHash),
              ),
            )
            .subscribe({
              error: (error: any) => {
                this.#log.error(error, '[%s] %s error on origin stream', this.#id, networkId)
              },
              next: (msg: BasejumpInitiatedWithContext) => {
                this.#engine.onOutboundMessage(new BasejumpInitiated(msg))
              },
              complete: () => this.#log.info('[%s] %s complete on origin stream', this.#id, networkId),
            }),
        })
      } else {
        this.#log.warn('[%s] Outbound stream not supported for chain %s', this.#id, network)
      }
    }

    this.#streams.o = subs
  }

  #monitorRelays() {
    if (this.#streams.r.length > 0) {
      throw new Error('Relay streams already open')
    }
    const relayId = networks.moonbeam
    const proxyAddress = CONFIG.relay[relayId]

    const subs: RxSubscriptionWithId[] = [
      {
        id: `${relayId}.relay`,
        sub: this.#shared
          .blockExtrinsics(relayId)
          .pipe(extractBasejumpProxy(relayId, proxyAddress))
          .subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s] %s error on relay stream', this.#id, relayId)
            },
            next: (msg: BasejumpRelayedWithContext) => {
              this.#engine.onRelayMessage(msg)
            },
            complete: () => this.#log.info('[%s] %s complete on relay stream', this.#id, relayId),
          }),
      },
    ]

    this.#streams.r = subs
  }

  #monitorDestinations() {
    if (this.#streams.d.length > 0) {
      throw new Error('Destination streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    for (const [network, contractAddress] of Object.entries(CONFIG.destination)) {
      const networkId = network as NetworkURN
      const consensus = getConsensus(networkId)
      if (consensus === 'polkadot') {
        subs.push({
          id: `${networkId}.in`,
          sub: this.#shared
            .blockEvents(networkId)
            .pipe(extractBasejumpLanding(networkId, contractAddress))
            .subscribe({
              error: (error: any) => {
                this.#log.error(error, '[%s] %s error on destination stream', this.#id, networkId)
              },
              next: (msg: BasejumpLandedWithContext) => {
                this.#engine.onInboundMessage(msg)
              },
              complete: () => this.#log.info('[%s] %s complete on destination stream', this.#id, networkId),
            }),
        })
      } else {
        this.#log.warn('[%s] Inbound stream not supported for chain %s', this.#id, network)
      }
    }
  }
}

import { Operation } from 'rfc6902'
import { combineLatest, map, Observable, shareReplay } from 'rxjs'
import { getConsensus } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AssetId } from '../steward/types.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { remoteIssuanceMappers } from './mappers/remote.js'
import { reserveBalanceMappers } from './mappers/reserve.js'
import { $CrosschainIssuanceInput, CrosschainIssuanceHandler, CrosschainIssuanceInput } from './types.js'

const XC_ISSUANCE_AGENT_ID = 'invariant'

type CachedStream<T> = {
  stream$: Observable<T>
  refCount: number
}

export class CrosschainIssuanceAgent implements Agent, Subscribable {
  id = XC_ISSUANCE_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Crosschain Issuance Agent',
    description: 'Tracks crosschain asset issuance.',
    capabilities: getAgentCapabilities(this),
  }

  readonly inputSchema = $CrosschainIssuanceInput
  readonly #log: Logger
  readonly #notifier: Egress
  readonly #ingress: IngressConsumers
  readonly #reserveBalanceMappers: Record<
    string,
    (ctx: { assetId: AssetId; address: string }) => Observable<bigint>
  >
  readonly #remoteIssuanceMappers: Record<string, (ctx: { assetId: AssetId }) => Observable<bigint>>
  readonly #reserveCache = new Map<string, CachedStream<string>>()
  readonly #remoteCache = new Map<string, CachedStream<string>>()

  readonly #subs: Map<string, CrosschainIssuanceHandler> = new Map()

  constructor(ctx: AgentRuntimeContext) {
    const { log, ingress, egress } = ctx

    this.#log = log
    this.#notifier = egress
    this.#ingress = ingress
    this.#reserveBalanceMappers = reserveBalanceMappers(ingress)
    this.#remoteIssuanceMappers = remoteIssuanceMappers(ingress)
  }

  start(subs: Subscription<CrosschainIssuanceInput>[] = []) {
    if (subs.length > 0) {
      this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

      for (const sub of subs) {
        try {
          this.subscribe(sub)
        } catch (error) {
          this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
        }
      }
    }
    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    for (const handler of this.#subs.values()) {
      handler.stream.unsubscribe()
    }
    this.#log.info('[agent:%s] stopped', this.id)
  }

  subscribe(sub: Subscription<CrosschainIssuanceInput>) {
    const isValid = this.#validateArgs(sub.args)
    if (!isValid) {
      return
    }
    const rxSub = this.#monitor(sub)
    if (rxSub === null) {
      return
    }
    this.#subs.set(sub.id, rxSub)
  }

  unsubscribe(id: string) {
    try {
      const handler = this.#subs.get(id)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  collectTelemetry() {
    //
  }

  #monitor(subscription: Subscription<CrosschainIssuanceInput>): CrosschainIssuanceHandler | null {
    const { args } = subscription

    try {
      const reserveBalance$ = this.#getReserveStream({
        chainId: args.reserveChain as NetworkURN,
        assetId: args.reserveAssetId,
        reserveAddress: args.reserveAddress,
      })

      const remoteIssuance$ = this.#getRemoteStream({
        chainId: args.remoteChain as NetworkURN,
        assetId: args.remoteAssetId,
      })

      const stream = combineLatest([reserveBalance$, remoteIssuance$])
        .pipe(
          map(([reserve, issuance]) => ({
            invariant: args,
            reserve,
            issuance,
          })),
        )
        .subscribe({
          next: (v) => console.log('INV', v),
          error: (err) => console.error(err, 'Error in invariant sub'),
          complete: () => console.log('Unexpected complete'),
        })
      return {
        subscription,
        stream,
      }
    } catch (err) {
      this.#log.error(err, '[agent:%s] Error on monitor %o', this.id, args)
      return null
    }
  }

  #isNetworkDefined(network: NetworkURN): boolean {
    const consensus = getConsensus(network)
    if (consensus === 'polkadot') {
      return this.#ingress.substrate.isNetworkDefined(network)
    }
    if (consensus === 'ethereum') {
      return this.#ingress.evm.isNetworkDefined(network)
    }
    return false
  }

  #validateArgs(input: CrosschainIssuanceInput): boolean {
    const reserve = input.reserveChain as NetworkURN
    const remote = input.remoteChain as NetworkURN

    if (!this.#isNetworkDefined(reserve)) {
      this.#log.warn('[agent:%s] Unsupported reserve network %s', this.id, reserve)
      return false
    }

    if (!this.#isNetworkDefined(remote)) {
      this.#log.warn('[agent:%s] Unsupported remote network %s', this.id, remote)
      return false
    }

    const reserveMapper = this.#reserveBalanceMappers[reserve]
    if (!reserveMapper) {
      this.#log.warn('[agent:%s] Reserve balance mapper not defined for reserve network %s', this.id, reserve)
      return false
    }

    const remoteMapper = this.#remoteIssuanceMappers[remote]
    if (!remoteMapper) {
      this.#log.warn('[agent:%s] Remote issuance mapper not defined for remote network %s', this.id, remote)
      return false
    }

    return true
  }

  #getReserveStream({
    chainId,
    reserveAddress,
    assetId,
  }: {
    chainId: NetworkURN
    assetId: AssetId
    reserveAddress: string
  }) {
    const key = `${chainId}|${assetId}|${reserveAddress}`

    if (!this.#reserveCache.has(key)) {
      const mapper = this.#reserveBalanceMappers[chainId]

      const balance$ = mapper({
        assetId: assetId,
        address: reserveAddress,
      })

      const stream$ = balance$.pipe(map((value) => value.toString()))

      return this.#createManagedStream(key, stream$, this.#reserveCache)
    }

    return this.#reserveCache.get(key)!.stream$
  }

  #getRemoteStream({ assetId, chainId }: { chainId: NetworkURN; assetId: AssetId }) {
    const key = `${chainId}|${assetId}`

    if (!this.#remoteCache.has(key)) {
      const mapper = this.#remoteIssuanceMappers[chainId]

      const issuance$ = mapper({
        assetId: assetId,
      })

      const stream$ = issuance$.pipe(map((value) => value.toString()))

      return this.#createManagedStream(key, stream$, this.#remoteCache)
    }

    return this.#remoteCache.get(key)!.stream$
  }

  #createManagedStream<T>(
    key: string,
    source$: Observable<T>,
    cache: Map<string, CachedStream<T>>,
  ): Observable<T> {
    const shared$ = source$.pipe(shareReplay({ bufferSize: 1, refCount: true }))

    const entry: CachedStream<T> = {
      stream$: new Observable<T>((subscriber) => {
        entry.refCount++

        const sub = shared$.subscribe(subscriber)

        return () => {
          sub.unsubscribe()
          entry.refCount--

          if (entry.refCount === 0) {
            cache.delete(key)
          }
        }
      }),
      refCount: 0,
    }

    cache.set(key, entry)

    return entry.stream$
  }
}

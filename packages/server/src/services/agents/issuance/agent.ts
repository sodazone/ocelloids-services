import { Operation } from 'rfc6902'
import { combineLatest, map, Observable, shareReplay } from 'rxjs'
import { createTypedEventEmitter } from '@/common/util.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { decodeSovereignAccount } from '@/services/networking/substrate/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { toMelbourne } from '../common/melbourne.js'
import { AssetId } from '../steward/types.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  getAgentCapabilities,
  Queryable,
  QueryParams,
  QueryResult,
  Subscribable,
} from '../types.js'
import { remoteIssuanceMappers } from './mappers/remote.js'
import { reserveBalanceMappers } from './mappers/reserve.js'
import { issuanceAgentMetrics, TelemetryIssuanceEventEmitter } from './telemetry.js'
import {
  $CrosschainIssuanceInputs,
  $CrosschainIssuanceQueryArgs,
  CrosschainIssuanceHandler,
  CrosschainIssuanceInputs,
  CrosschainIssuancePayload,
  CrosschainIssuanceQueryArgs,
} from './types.js'

const XC_ISSUANCE_AGENT_ID = 'issuance'

type CachedStream<T> = {
  stream$: Observable<T>
  refCount: number
}

export class CrosschainIssuanceAgent implements Agent, Subscribable, Queryable {
  id = XC_ISSUANCE_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Crosschain Issuance Agent',
    description: 'Tracks crosschain asset issuance.',
    capabilities: getAgentCapabilities(this),
  }
  querySchema = $CrosschainIssuanceQueryArgs

  readonly inputSchema = $CrosschainIssuanceInputs

  readonly #log: Logger
  readonly #notifier: Egress
  readonly #ingress: IngressConsumers
  readonly #telemetry: TelemetryIssuanceEventEmitter

  readonly #reserveBalanceMappers: Record<
    string,
    (ctx: { assetId: AssetId; address: string }) => Observable<bigint>
  >
  readonly #remoteIssuanceMappers: Record<string, (ctx: { assetId: AssetId }) => Observable<bigint>>
  readonly #reserveCache = new Map<string, CachedStream<string>>()
  readonly #remoteCache = new Map<string, CachedStream<string>>()

  readonly #subs: Map<string, CrosschainIssuanceHandler> = new Map()
  readonly #dbIssuance: LevelDB<string, CrosschainIssuancePayload>

  constructor(ctx: AgentRuntimeContext) {
    const { log, ingress, egress, openLevelDB } = ctx

    this.#log = log
    this.#notifier = egress
    this.#ingress = ingress
    this.#telemetry = createTypedEventEmitter<TelemetryIssuanceEventEmitter>()

    this.#reserveBalanceMappers = reserveBalanceMappers(ingress)
    this.#remoteIssuanceMappers = remoteIssuanceMappers(ingress)
    this.#dbIssuance = openLevelDB('issuance:last', { valueEncoding: 'json' })
  }

  start(subs: Subscription<CrosschainIssuanceInputs>[] = []) {
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

  subscribe(sub: Subscription<CrosschainIssuanceInputs>) {
    this.#validateArgs(sub.args)
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
      this.#dbIssuance.del(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  collectTelemetry() {
    issuanceAgentMetrics(this.#telemetry)
  }

  async query(params: QueryParams<CrosschainIssuanceQueryArgs>): Promise<QueryResult> {
    if (params.args.op === 'issuance.last') {
      const id = params.args.criteria.subscriptionId
      const lastStored = await this.#dbIssuance.get(id)
      return { items: lastStored ? [lastStored] : [] }
    }

    throw new Error('Unknown query op')
  }

  #monitor(subscription: Subscription<CrosschainIssuanceInputs>): CrosschainIssuanceHandler | null {
    const { id, args } = subscription

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
          map(
            ([reserve, remote]) =>
              ({
                inputs: args,
                reserve,
                remote,
              }) as CrosschainIssuancePayload,
          ),
        )
        .subscribe({
          next: (payload) => {
            if (this.#subs.has(id)) {
              const handler = this.#subs.get(id)
              if (!handler) {
                this.#log.error(`No subscription handler found for subscription ID ${id}`)
                return
              }
              this.#dbIssuance.put(id, payload)
              this.#notifier.publish(handler.subscription, {
                metadata: {
                  type: 'issuance',
                  subscriptionId: id,
                  agentId: this.id,
                  networkId: args.reserveChain as NetworkURN,
                  timestamp: Date.now(),
                },
                payload: payload as unknown as AnyJson,
              })
            } else {
              // this could happen with closed ephemeral subscriptions
              this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
            }
          },
          complete: () => {
            this.#telemetry.emit('telemetryIssuanceStreamError', {
              code: 'ISSUANCE_STREAM_COMPLETE',
              id: `${args.reserveChain}_${toMelbourne(args.reserveAssetId)}_${args.remoteChain}_${toMelbourne(args.remoteAssetId)}`,
            })
            this.#log.warn(`[agent:%s] Stream completed`, this.id)
            if (this.#subs.has(id)) {
              const handler = this.#subs.get(id)
              if (!handler) {
                this.#log.error(`No subscription handler found for subscription ID ${id}`)
                return
              }
              if (handler.subscription.ephemeral) {
                this.#notifier.terminate(handler.subscription)
              }
            }
          },
          error: (err) => {
            this.#telemetry.emit('telemetryIssuanceStreamError', {
              code: 'ISSUANCE_STREAM_ERROR',
              id: `${args.reserveChain}_${toMelbourne(args.reserveAssetId)}_${args.remoteChain}_${toMelbourne(args.remoteAssetId)}`,
            })
            this.#log.error(err, `[agent:%s] Stream errored`, this.id)
            if (this.#subs.has(id)) {
              const handler = this.#subs.get(id)
              if (!handler) {
                this.#log.error(`No subscription handler found for subscription ID ${id}`)
                return
              }
              if (handler.subscription.ephemeral) {
                this.#notifier.terminate(handler.subscription)
              }
            }
          },
        })

      return {
        subscription,
        stream,
      }
    } catch (err) {
      this.#log.error(err, '[agent:%s] Error on monitor %o', this.id, args)
      throw err
    }
  }

  #isNetworkDefined(network: NetworkURN): boolean {
    const consensus = getConsensus(network)
    if (consensus === 'polkadot' || consensus === 'kusama' || consensus === 'paseo') {
      return this.#ingress.substrate.isNetworkDefined(network)
    }
    if (consensus === 'ethereum') {
      return this.#ingress.evm.isNetworkDefined(network)
    }
    return false
  }

  #validateArgs(input: CrosschainIssuanceInputs) {
    const reserve = input.reserveChain as NetworkURN
    const remote = input.remoteChain as NetworkURN

    if (!this.#isNetworkDefined(reserve)) {
      throw new Error(`Unsupported reserve network ${reserve}`)
    }

    if (!this.#isNetworkDefined(remote)) {
      throw new Error(`Unsupported remote network ${remote}`)
    }

    const reserveMapper = this.#reserveBalanceMappers[reserve]
    if (!reserveMapper) {
      throw new Error(`Reserve balance mapper not defined for reserve network ${reserve}`)
    }

    const remoteMapper = this.#remoteIssuanceMappers[remote]
    if (!remoteMapper) {
      throw new Error(`Remote balance mapper not defined for remote network ${remote}`)
    }

    const reserveConsensus = getConsensus(reserve)
    const remoteConsensus = getConsensus(remote)
    if (reserveConsensus === remoteConsensus && reserveConsensus !== 'ethereum') {
      const { prefix, paraId } = decodeSovereignAccount(input.reserveAddress)
      if (prefix !== 'sibl' || paraId.toString() !== getChainId(remote)) {
        throw new Error(
          `Reserve address does not correspond to remote chain. Decoded reserve address: ${prefix}:${paraId}`,
        )
      }
    }
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
    const key = `${chainId}|${toMelbourne(assetId)}|${reserveAddress}`

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
    const key = `${chainId}|${toMelbourne(assetId)}`

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

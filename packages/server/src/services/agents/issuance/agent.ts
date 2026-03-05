import { Operation } from 'rfc6902'
import {
  catchError,
  combineLatest,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
} from 'rxjs'
import { createTypedEventEmitter } from '@/common/util.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { decodeSovereignAccount } from '@/services/networking/substrate/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { toMelbourne } from '../common/melbourne.js'
import { limitCap, paginatedResults } from '../common/query.js'
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
import { createIssuanceInputsMap } from './mappers/inputs.js'
import { remoteIssuanceMappers } from './mappers/remote.js'
import { reserveBalanceMappers } from './mappers/reserve.js'
import { issuanceAgentMetrics, TelemetryIssuanceEventEmitter } from './telemetry.js'
import {
  $CrosschainIssuanceQueryArgs,
  $CrosschainIssuanceSubscriptionInputs,
  CrosschainIssuanceHandler,
  CrosschainIssuanceInputs,
  CrosschainIssuancePayload,
  CrosschainIssuanceQueryArgs,
  CrosschainIssuanceSubscriptionInputs,
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

  readonly inputSchema = $CrosschainIssuanceSubscriptionInputs

  readonly #log: Logger
  readonly #notifier: Egress
  readonly #ingress: IngressConsumers
  readonly #telemetry: TelemetryIssuanceEventEmitter

  readonly #inputsMap: Map<string, CrosschainIssuanceInputs[]>
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

    this.#inputsMap = createIssuanceInputsMap()
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

  subscribe(sub: Subscription<CrosschainIssuanceSubscriptionInputs>) {
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
    const { args, pagination } = params
    if (args.op === 'issuance.last') {
      const subscriptionId = args.criteria.subscriptionId
      const cursor = pagination?.cursor

      const iterator = this.#dbIssuance.iterator({
        ...(cursor ? { gt: cursor } : { gte: `${subscriptionId}|` }),
        lte: `${subscriptionId}|\xFF`,
        limit: limitCap(pagination),
      })

      return paginatedResults<string, CrosschainIssuancePayload>(iterator)
    }

    throw new Error('Unknown query op')
  }

  #monitor(
    subscription: Subscription<CrosschainIssuanceSubscriptionInputs>,
  ): CrosschainIssuanceHandler | null {
    const { id, args } = subscription

    const key = `${args.reserveChain}-${args.remoteChain}`
    const inputs = this.#inputsMap.get(key)

    if (!inputs || inputs.length === 0) {
      throw new Error(`No issuance inputs found for ${key}`)
    }

    try {
      const stream$ = from(inputs).pipe(
        mergeMap((input) => {
          const reserveConsensus = getConsensus(input.reserveChain)
          const remoteConsensus = getConsensus(input.remoteChain)
          if (reserveConsensus === remoteConsensus && reserveConsensus !== 'ethereum') {
            const { prefix, paraId } = decodeSovereignAccount(input.reserveAddress)
            if (prefix !== 'sibl' || paraId.toString() !== getChainId(input.remoteChain)) {
              this.#log.error(
                '[agent:%s] Reserve address does not correspond to remote chain. Decoded reserve address: %s:%s',
                this.id,
                prefix,
                paraId,
              )
              return of(null)
            }
          }
          const reserveBalance$ = this.#getReserveStream({
            chainId: input.reserveChain as NetworkURN,
            assetId: input.reserveAssetId,
            reserveAddress: input.reserveAddress,
          })

          const remoteIssuance$ = this.#getRemoteStream({
            chainId: input.remoteChain as NetworkURN,
            assetId: input.remoteAssetId,
          })

          return combineLatest([reserveBalance$, remoteIssuance$]).pipe(
            catchError((err) => {
              this.#log.error(
                err,
                '[agent:%s] Error in input stream %s-%s',
                this.id,
                input.reserveChain,
                input.remoteChain,
              )
              return EMPTY
            }),
            map(([reserve, remote]) => ({
              inputs: input,
              reserve,
              remote,
            })),
          )
        }),
        filter((s) => s !== null),
      )

      const sub = stream$.subscribe({
        next: (payload) => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }

            const melbournedReserveAsset = toMelbourne(payload.inputs.reserveAssetId)
            const melbournedRemoteAsset = toMelbourne(payload.inputs.remoteAssetId)

            const p: CrosschainIssuancePayload = {
              ...payload,
              inputs: {
                ...payload.inputs,
                reserveAssetId: melbournedReserveAsset,
                remoteAssetId: melbournedRemoteAsset,
              },
            }
            this.#dbIssuance.put(`${id}|${melbournedReserveAsset}`, p)
            this.#notifier.publish(handler.subscription, {
              metadata: {
                type: 'issuance',
                subscriptionId: id,
                agentId: this.id,
                networkId: args.reserveChain as NetworkURN,
                timestamp: Date.now(),
              },
              payload: p as unknown as AnyJson,
            })
          } else {
            // this could happen with closed ephemeral subscriptions
            this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
          }
        },
        complete: () => {
          this.#telemetry.emit('telemetryIssuanceStreamError', {
            code: 'ISSUANCE_STREAM_COMPLETE',
            id: `${args.reserveChain}_${args.remoteChain}`,
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
            id: `${args.reserveChain}_${args.remoteChain}`,
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
        stream: sub,
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

  #validateArgs(input: CrosschainIssuanceSubscriptionInputs) {
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

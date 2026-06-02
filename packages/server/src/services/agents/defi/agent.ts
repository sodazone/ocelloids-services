import { Migrator } from 'kysely'
import { Operation } from 'rfc6902'
import { filter, map, merge, Observable, Subscription as RxSubscription } from 'rxjs'
import { maskPassword } from '@/common/url.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { SubstrateAccountMetadata } from '../steward/accounts/types.js'
import { DataSteward } from '../steward/agent.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '../steward/types.js'
import { TickerAgent } from '../ticker/agent.js'
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
import { hydrationDexMonitor } from './networks/hydration/monitor.js'
import { moonbeamDexMonitor } from './networks/moonbeam/monitor.js'
import { createDefiDatabase } from './repositories/db.js'
import { DefiRepository } from './repositories/repository.js'
import {
  $DefiAgentInputs,
  $DefiAgentQueryArgs,
  DefiAgentInputs,
  DefiAgentQueryArgs,
  DefiPricePayload,
  DefiSubscriptionPayload,
} from './types.js'

const DEFI_AGENT_ID = 'defi'
export const DEFAULT_DEFI_PATH = 'db.defi.sqlite'
const DEFI_DB_CONNECTION = process.env.OC_DEFI_DB_CONNECTION

type DefiMonitor = {
  start: () => Promise<void> | void
  stop: () => void
  chainId: NetworkURN
  config: {
    evm: boolean
    substrate: boolean
  }
  events$: Observable<DefiSubscriptionPayload>
}

type SubscriptionHandler = {
  subscription: Subscription<DefiAgentInputs>
  stream: RxSubscription
}

type DefiAgentDependencies = {
  steward: DataSteward
  ticker: TickerAgent
}

export class DefiAgent implements Agent, Subscribable, Queryable {
  id = DEFI_AGENT_ID
  metadata: AgentMetadata = {
    name: 'DeFi Agent',
    description: 'Indexes and tracks DeFi activity and liquidity.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #log: Logger

  readonly #ingress: IngressConsumers
  readonly #notifier: Egress
  readonly #dependencies: DefiAgentDependencies

  readonly #monitors: DefiMonitor[]
  readonly #subs: Map<string, SubscriptionHandler> = new Map()

  readonly #repository: DefiRepository
  readonly #migrator: Migrator
  readonly #writers: RxSubscription[]

  readonly inputSchema = $DefiAgentInputs
  readonly querySchema = $DefiAgentQueryArgs

  constructor(ctx: AgentRuntimeContext, deps: DefiAgentDependencies) {
    const { ingress, egress } = ctx

    this.#log = ctx.log
    this.#ingress = ingress
    this.#notifier = egress
    this.#dependencies = deps
    this.#writers = []
    this.#monitors = []

    const connectionString =
      DEFI_DB_CONNECTION ?? resolveDataPath(DEFAULT_DEFI_PATH, ctx.environment?.dataPath)
    this.#log.info('[agent:%s] database at %s', this.id, maskPassword(connectionString))
    const { db, dialect, migrator } = createDefiDatabase(connectionString)
    this.#repository = new DefiRepository(db, dialect)
    this.#migrator = migrator
  }

  async start(subs?: Subscription<DefiAgentInputs>[]) {
    this.#log.info('[agent:%s] starting db migration', this.id)

    const result = await this.#migrator.migrateToLatest()

    if (result.results && result.results.length > 0) {
      this.#log.info('[agent:%s] db migration complete %o', this.id, result.results)
    } else if (result.error) {
      this.#log.error(result.error, '[agent:%s] db migration error', this.id)
      throw new Error('Migration error')
    }

    const deps = {
      fetchAccounts: this.#fetchAccounts.bind(this),
      fetchAssetMetadata: this.#fetchAssetMetadata.bind(this),
      listLatestPrices: this.#listLatestPrices.bind(this),
    }

    this.#addMonitors(
      hydrationDexMonitor(this.#log, this.#ingress, deps),
      moonbeamDexMonitor(this.#log, this.#ingress.evm, deps),
    )

    for (const monitor of this.#monitors) {
      this.#writers.push(
        monitor.events$.subscribe({
          next: async (payload) => {
            if (payload.type === 'liquidity') {
              await this.#repository.upsertLiquidityData(payload)
            } else if (payload.type === 'event') {
              await this.#repository.insertDefiEvent(payload)
            } else if (payload.type === 'price') {
              await this.#repository.upsertDefiPrice(payload)
            } else if (payload.type === 'order') {
              // await this.#repository.processOrderFill(payload)
            }
          },
        }),
      )

      monitor.start()

      this.#log.info('[agent:%s] starting monitor %s', this.id, monitor.chainId)
    }

    if (subs !== undefined && subs.length > 0) {
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

    for (const monitor of this.#monitors) {
      monitor.stop()
    }

    for (const writer of this.#writers) {
      writer.unsubscribe()
    }

    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    // TODO
  }

  subscribe(subscription: Subscription<DefiAgentInputs>) {
    const { id, args } = subscription

    const selectedMonitors =
      args.networks === '*' ? this.#monitors : this.#monitors.filter((m) => args.networks.includes(m.chainId))

    const combinedStream$ = merge(
      ...selectedMonitors.map((monitor) =>
        monitor.events$.pipe(
          filter((payload) => payload.type === args.topic),
          filter((payload) => {
            if (payload.type === 'liquidity') {
              // TODO: liquidity filters
            }

            if (payload.type === 'event') {
              // TODO: event filters
            }

            return true
          }),

          map((payload) => ({ payload, chainId: monitor.chainId })),
        ),
      ),
    )

    const stream = combinedStream$.subscribe({
      next: ({ payload, chainId }) => {
        this.#notifier.publish(subscription, {
          metadata: {
            type: 'defi',
            subscriptionId: id,
            agentId: this.id,
            networkId: chainId,
            timestamp: Date.now(),
          },
          payload,
        })
      },
      error: (err) => this.#log.error(err, '[agent:%s] stream error for sub %s', this.id, id),
    })

    this.#subs.set(id, { subscription, stream })
  }

  unsubscribe(subscriptionId: string) {
    try {
      const handler = this.#subs.get(subscriptionId)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, subscriptionId)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(subscriptionId)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, subscriptionId)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription {
    throw new Error('Update not supported')
  }

  async query(params: QueryParams<DefiAgentQueryArgs>): Promise<QueryResult> {
    const { args, pagination } = params

    if (args.op === 'liquidity.last') {
      return await this.#repository.getLatestPoolStates(params)
    }

    if (args.op === 'events') {
      return await this.#repository.findEvents(params)
    }

    if (args.op === 'price.last') {
      return await this.#repository.getLatestPrices(params)
    }

    if (args.op === 'orders.list') {
      return await this.#repository.listOrders(args.criteria, pagination)
    }

    throw new Error('Unknown query op')
  }

  #addMonitors(...monitors: DefiMonitor[]) {
    for (const m of monitors) {
      if (
        (!m.config.substrate || this.#ingress.substrate.isNetworkDefined(m.chainId)) &&
        (!m.config.evm || this.#ingress.evm.isNetworkDefined(m.chainId))
      ) {
        this.#monitors.push(m)
      } else {
        this.#log.warn('[agent:%s] network %s not defined, monitor not started', this.id, m.chainId)
      }
    }
  }

  async #listLatestPrices(network: string): Promise<DefiPricePayload[]> {
    let cursor: string | undefined = undefined
    let hasNextPage = true

    const all: DefiPricePayload[] = []

    while (hasNextPage) {
      const res = await this.#getLatestPrices(network, cursor)

      all.push(...res.items)

      hasNextPage = res.pageInfo?.hasNextPage ?? false
      cursor = res.pageInfo?.endCursor
    }

    return all
  }

  async #getLatestPrices(network: string, cursor?: string): Promise<QueryResult<DefiPricePayload>> {
    return this.#repository.getLatestPrices({
      args: {
        op: 'price.last',
        criteria: {
          networks: [network],
        },
      },
      pagination: {
        cursor,
        limit: 50,
      },
    })
  }

  async #fetchAssetMetadata(network: string, assets: string[]): Promise<AssetMetadata[]> {
    const { items } = (await this.#dependencies.steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network,
            assets,
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    return items.map((i) => (isAssetMetadata(i) ? i : null)).filter((i) => i !== null)
  }

  async #fetchAccounts(accounts: string[]): Promise<(SubstrateAccountMetadata | Empty)[]> {
    const { items } = (await this.#dependencies.steward.query({
      args: {
        op: 'accounts',
        criteria: {
          accounts,
        },
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<SubstrateAccountMetadata | Empty>

    return items
  }
}

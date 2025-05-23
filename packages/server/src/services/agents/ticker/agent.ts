import { Scheduled, Scheduler } from '@/services/persistence/level/scheduler.js'
import { LevelDB, Logger } from '@/services/types.js'

import { ValidationError } from '@/errors.js'
import { AbstractSublevel } from 'abstract-level'
import { OMEGA_250 } from '../steward/queries/consts.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  getAgentCapabilities,
} from '../types.js'
import { tickerToAssetIdMap } from './mappers.js'
import { BinancePriceScout } from './scouts/binance.js'
import { CoinGeckoPriceScout } from './scouts/coingecko.js'
import { PriceScout } from './scouts/interface.js'
import {
  $TickerQueryArgs,
  AggregatedPriceData,
  AssetPriceData,
  AssetTickerData,
  TickerQueryArgs,
} from './types.js'

const PRICE_SYNC_TASK = 'task:reporter:price-sync'
const AGENT_LEVEL_PREFIX = 'agent:reporter'
const PRICES_LEVEL_PREFIX = 'agent:reporter:prices'

const START_DELAY = 30_000 // 30s
const SCHED_RATE = 900_000 // 15m

export class TickerAgent implements Agent, Queryable {
  id = 'ticker'

  querySchema = $TickerQueryArgs

  metadata: AgentMetadata = {
    name: 'Ticker Agent',
    description: 'Aggregates prices from multiple sources for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }
  readonly #log: Logger

  readonly #sched: Scheduler

  readonly #db: LevelDB
  readonly #dbPrices: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetPriceData>
  readonly #scouts: PriceScout[]

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#sched = ctx.scheduler
    this.#db = ctx.db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbPrices = ctx.db.sublevel<string, AssetPriceData>(PRICES_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    // XXX proper config and loading
    this.#scouts = [new BinancePriceScout(), new CoinGeckoPriceScout()]

    this.#sched.on(PRICE_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  stop(): void {
    // noop
  }

  async start(): Promise<void> {
    if (this.#sched.enabled /*&& (await this.#isNotScheduled())*/) {
      await this.#scheduleUpdate()

      // first-time sync
      this.#log.info('[agent:%s] delayed initial update in %s', this.id, START_DELAY)
      const timeout = setTimeout(async () => {
        await this.#updatePrices()
      }, START_DELAY)
      timeout.unref()
    }
  }
  collectTelemetry(): void {
    // TODO: impl telemetry
  }

  query(
    params: QueryParams<TickerQueryArgs>,
  ): Promise<QueryResult<string | AssetTickerData | AggregatedPriceData>> {
    if (params.args.op === 'prices.sources') {
      return Promise.resolve({ items: this.#scouts.map((scout) => scout.source) })
    }
    if (params.args.op === 'prices.assets') {
      return Promise.resolve({
        items: Object.entries(tickerToAssetIdMap).map(([ticker, asset]) => ({ ticker, asset })),
      })
    }
    if (params.args.op === 'prices') {
      return this.#queryPrices(params.args.criteria)
    }
    if (params.args.op === 'prices.by_ticker') {
      return this.#queryPriceByTicker(params.args.criteria)
    }

    /* c8 ignore next */
    throw new ValidationError('Unknown query type')
  }

  async #queryPrices(criteria?: { sources: string[] | '*' }): Promise<QueryResult<AggregatedPriceData>> {
    const tickers = Object.keys(tickerToAssetIdMap)
    return await this.#queryPriceByTicker(tickers.map((t) => ({ ticker: t, sources: criteria?.sources })))
  }

  async #queryPriceByTicker(
    criteria: {
      ticker: string
      sources?: string[] | '*'
    }[],
  ): Promise<QueryResult<AggregatedPriceData>> {
    const allItems: AggregatedPriceData[] = []

    for (const { ticker, sources } of criteria) {
      const normalisedTicker = ticker.toLowerCase()
      let items: AssetPriceData[] = []

      if (sources === undefined || sources === '*') {
        const iterator = this.#dbPrices.iterator<string, AssetPriceData>({
          gt: normalisedTicker,
          lt: normalisedTicker + ':' + OMEGA_250,
        })
        items = (await iterator.all()).map(([_key, value]) => value)
      } else {
        const keys = sources.map((s) => this.#toPriceKey(normalisedTicker, s))
        items = (
          await this.#dbPrices.getMany<string, AssetPriceData>(keys, {
            /** */
          })
        ).filter((x) => x !== undefined)
      }

      if (items.length > 0) {
        const aggregatedPrice = items.reduce((sum, item) => sum + item.price, 0) / items.length

        const aggregatedItem: AggregatedPriceData = {
          ticker,
          asset: items[0].asset,
          aggregatedPrice,
          updated: Math.max(...items.map((item) => item.updated)), // Use the latest update timestamp
          sources: items.map((item) => ({
            name: item.source,
            sourcePrice: item.price,
          })),
        }

        allItems.push(aggregatedItem)
      }
    }

    return { items: allItems }
  }

  async #onScheduledTask() {
    await this.#updatePrices()
    await this.#scheduleUpdate()
  }

  async #scheduleUpdate() {
    const time = new Date(Date.now() + SCHED_RATE)
    const timeString = time.toISOString()
    const key = timeString + PRICE_SYNC_TASK
    const task = {
      key,
      type: PRICE_SYNC_TASK,
      task: null,
    } as Scheduled

    await this.#sched.schedule(task)
    await this.#db.put('scheduled', true)

    this.#log.info('[agent:%s] sync scheduled %s', this.id, timeString)
  }

  async #updatePrices() {
    try {
      const tickers = Object.keys(tickerToAssetIdMap)
      const results = await Promise.allSettled(this.#scouts.map((scout) => scout.fetchPrices(tickers)))
      const prices = results.filter((result) => result.status === 'fulfilled').flatMap(({ value }) => value)
      const batch = this.#dbPrices.batch()

      for (const price of prices) {
        const asset = tickerToAssetIdMap[price.ticker]
        const key = this.#toPriceKey(price.ticker, price.source)
        batch.put(key, {
          ...price,
          asset,
        })
      }

      await batch.write()
      this.#log.info('[agent:%s] prices updated (#tickers=%s)', this.id, tickers.length)
    } catch (error) {
      this.#log.error(error, '[agent:%s] while writing updated prices', this.id)
    }
  }

  async #isNotScheduled() {
    return (await this.#db.get('scheduled')) === undefined
  }

  #toPriceKey(ticker: string, source: string) {
    return `${ticker.toLowerCase()}:${source.toLowerCase()}`
  }
}

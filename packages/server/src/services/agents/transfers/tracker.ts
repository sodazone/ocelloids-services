import { Subscription as RxSubscription, Subject, share } from 'rxjs'
import { normaliseDecimals } from '@/common/numbers.js'
import { ValidationError } from '@/errors.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'
import { DataSteward } from '@/services/agents/steward/agent.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '@/services/agents/steward/types.js'
import { TickerAgent } from '@/services/agents/ticker/agent.js'
import { AggregatedPriceData, TickerQueryArgs } from '@/services/agents/ticker/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { QueryParams, QueryResult } from '../types.js'
import { transferStreamMappers } from './streams/index.js'
import { EnrichedTransfer } from './type.js'

export class TransfersTracker {
  readonly #id = 'transfers-tracker'
  readonly #log: Logger
  readonly #ingress: SubstrateIngressConsumer
  readonly #shared: SubstrateSharedStreams
  readonly #steward: DataSteward
  readonly #ticker: TickerAgent
  readonly #subject: Subject<EnrichedTransfer>

  readonly #streams: Record<string, RxSubscription> = {}
  readonly transfers$

  constructor({
    log,
    ingress,
    steward,
    ticker,
  }: { log: Logger; ingress: SubstrateIngressConsumer; steward: DataSteward; ticker: TickerAgent }) {
    this.#log = log
    this.#ingress = ingress
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#steward = steward
    this.#ticker = ticker

    this.#subject = new Subject<EnrichedTransfer>()
    this.transfers$ = this.#subject.pipe(share())
  }

  async start() {
    this.#log.info('[agent:%s] wait APIs ready', this.#id)
    await this.#ingress.isReady()
    this.#log.info('[agent:%s] APIs ready', this.#id)

    const chainIds = this.#ingress.getChainIds()
    for (const chainId of chainIds) {
      this.#subscribeTransfers(chainId)
      this.#log.info('[agent:%s] %s stream subscribed ', this.#id, chainId)
    }
    this.#log.info('[agent:%s] started', this.#id)
  }

  stop() {
    for (const [chainId, sub] of Object.entries(this.#streams)) {
      sub.unsubscribe()
      this.#log.info('[agent:%s] %s stream unsubscribed ', this.#id, chainId)
    }
    this.#log.info('[agent:%s] stopped', this.#id)
  }

  validateNetworks(networks: NetworkURN[]) {
    networks.forEach((chainId) => {
      if (!this.#ingress.isNetworkDefined(chainId as NetworkURN)) {
        throw new ValidationError('Unsupported network:' + chainId)
      }
    })
  }

  #subscribeTransfers(chainId: NetworkURN) {
    if (this.#streams[chainId]) {
      this.#log.warn('[%s:%s] Transfers already subscribed', this.#id, chainId)
      return
    }
    const mapper = transferStreamMappers[chainId]
    if (!mapper) {
      this.#log.warn('[%s:%s] No mapper defined, skipping...', this.#id, chainId)
      return
    }
    const blockEvents$ = this.#shared.blockEvents(chainId)
    const sub = mapper(blockEvents$).subscribe({
      next: async (transfer) => {
        // enrich with categories, asset metadata, asset price etc...
        const metadata = await this.#fetchAssetMetadata(chainId, transfer.asset)
        if (!metadata) {
          this.#subject.next({ ...transfer, chainId })
        } else {
          const enriched: EnrichedTransfer = {
            ...transfer,
            chainId,
            decimals: metadata.decimals,
            symbol: metadata.symbol,
            volume: await this.#resolveVolume(metadata, transfer.amount),
          }
          this.#subject.next(enriched)
        }
      },
      error: (err) => this.#log.error(err, '[%s:%s] Error on chain stream', this.#id, chainId),
    })
    this.#streams[chainId] = sub
  }

  async #fetchAssetMetadata(anchor: string, assetId: string): Promise<AssetMetadata | undefined> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: anchor,
            assets: [assetId],
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    if (items.length === 0) {
      return undefined
    }

    const result = items[0]
    return isAssetMetadata(result) ? result : undefined
  }

  async #resolveVolume(
    { chainId, id, decimals }: AssetMetadata,
    amount: string,
  ): Promise<number | undefined> {
    const { items } = (await this.#ticker.query({
      args: {
        op: 'prices.by_asset',
        criteria: [{ chainId, assetId: normalizeAssetId(id) }],
      },
    } as QueryParams<TickerQueryArgs>)) as QueryResult<AggregatedPriceData>

    const price = items.length > 0 ? items[0].medianPrice : null

    if (price === null || decimals === undefined) {
      return
    }
    const normalizedAmount = Number(normaliseDecimals(amount, decimals))
    return normalizedAmount * price
  }
}

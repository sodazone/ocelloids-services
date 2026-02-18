import { mergeMap, Subscription as RxSubscription, Subject } from 'rxjs'
import { normaliseDecimals } from '@/common/numbers.js'
import { isEVMAddress } from '@/common/util.js'
import { ValidationError } from '@/errors.js'
import { normalizeAssetId, toMelbourne } from '@/services/agents/common/melbourne.js'
import { DataSteward } from '@/services/agents/steward/agent.js'
import {
  AssetMetadata,
  Empty,
  isAccountMetadata,
  isAssetMetadata,
  StewardQueryArgs,
} from '@/services/agents/steward/types.js'
import { TickerAgent } from '@/services/agents/ticker/agent.js'
import { AggregatedPriceData, TickerQueryArgs } from '@/services/agents/ticker/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { SubstrateAccountMetadata } from '../steward/accounts/types.js'
import { QueryParams, QueryResult } from '../types.js'
import { isSystemAccount, resolveEvmToSubstratePubKey } from './convert.js'
import { transferStreamMappers } from './streams/index.js'
import { EnrichedTransfer, IcTransferType, isXcmLocation, Transfer } from './types.js'

const MAX_CONCURRENCY = 5

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
    this.transfers$ = this.#subject.asObservable()
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

    const sub = mapper(this.#shared.blockEvents(chainId))
      .pipe(
        mergeMap(async (transfer) => {
          const [fromAccount, toAccount, asset] = await Promise.all([
            this.#fetchAccount(transfer.from),
            this.#fetchAccount(transfer.to),
            this.#fetchAssetMetadata(chainId, transfer.asset),
          ])

          const from = this.#normaliseAddress(transfer.from, fromAccount)
          const to = this.#normaliseAddress(transfer.to, toAccount)
          const type = this.#classifyTransfer(from, to, fromAccount, toAccount)

          const tf: Transfer = {
            ...transfer,
            from,
            to,
            fromFormatted: isEVMAddress(from) ? from : transfer.fromFormatted,
            toFormatted: isEVMAddress(to) ? to : transfer.toFormatted,
          }

          if (!asset) {
            return { ...tf, chainId, type } satisfies EnrichedTransfer
          }

          return {
            ...tf,
            chainId,
            type,
            decimals: asset.decimals,
            symbol: asset.symbol,
            volume: await this.#resolveVolume(asset, transfer.amount),
          } satisfies EnrichedTransfer
        }, MAX_CONCURRENCY),
      )
      .subscribe({
        next: (enriched: EnrichedTransfer) => this.#subject.next(enriched),
        error: (err) => this.#log.error(err, '[%s:%s] Error on chain stream', this.#id, chainId),
      })

    this.#streams[chainId] = sub
  }

  #classifyTransfer(
    from: HexString,
    to: HexString,
    fromAccount?: SubstrateAccountMetadata,
    toAccount?: SubstrateAccountMetadata,
  ): IcTransferType {
    const fromTag = fromAccount?.tags
      ? fromAccount.tags.find(({ tag }) => tag.startsWith('protocol') || tag.startsWith('system'))
      : undefined
    const toTag = toAccount?.tags
      ? toAccount.tags.find(({ tag }) => tag.startsWith('protocol') || tag.startsWith('system'))
      : undefined

    const fromSystem = isSystemAccount(from) || fromTag !== undefined
    const toSystem = isSystemAccount(to) || toTag !== undefined

    if (fromSystem && toSystem) {
      return 'system'
    }
    if (fromSystem || toSystem) {
      return 'mixed'
    }
    return 'user'
  }

  async #fetchAssetMetadata(
    anchor: string,
    assetId: string | number | Record<string, any>,
  ): Promise<AssetMetadata | undefined> {
    if (isXcmLocation(assetId)) {
      return this.#fetchAssetByLocation(anchor, assetId)
    }

    const aId = typeof assetId !== 'string' ? toMelbourne(assetId) : assetId
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: anchor,
            assets: [aId],
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

  async #fetchAssetByLocation(
    anchor: string,
    assetId: { parents: number; interior: any },
  ): Promise<AssetMetadata | undefined> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets.by_location',
        criteria: [{ xcmLocationAnchor: anchor, locations: [JSON.stringify(assetId)] }],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    if (items.length === 0) {
      return undefined
    }

    const result = items[0]
    return isAssetMetadata(result) ? result : undefined
  }

  #normaliseAddress(address: HexString, account?: SubstrateAccountMetadata): HexString {
    if (address.length === 42) {
      if (account) {
        return account.publicKey
      }
      return resolveEvmToSubstratePubKey(address)
    }
    return address
  }

  async #fetchAccount(address: string): Promise<SubstrateAccountMetadata | undefined> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'accounts',
        criteria: {
          accounts: [address],
        },
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<SubstrateAccountMetadata | Empty>

    if (items.length === 0) {
      return undefined
    }

    const result = items[0]
    return isAccountMetadata(result) ? result : undefined
  }

  async #resolveVolume(
    { chainId, id, decimals, symbol, sourceId }: AssetMetadata,
    amount: string,
  ): Promise<number | undefined> {
    if (decimals === undefined) {
      return
    }

    const normalizedAmount = Number(normaliseDecimals(amount, decimals))

    const getMedianPrice = async (op: 'prices.by_ticker' | 'prices.by_asset', criteria: unknown) => {
      const { items } = (await this.#ticker.query({
        args: { op, criteria: [criteria] },
      } as QueryParams<TickerQueryArgs>)) as QueryResult<AggregatedPriceData>

      return items.length > 0 ? items[0].medianPrice : null
    }

    if (symbol) {
      const price = await getMedianPrice('prices.by_ticker', { ticker: symbol })
      if (price) {
        return normalizedAmount * price
      }
    }

    const priceQuery = {
      chainId: sourceId ? sourceId.chainId : chainId,
      assetId: normalizeAssetId(sourceId ? sourceId.id : id),
    }

    const price = await getMedianPrice('prices.by_asset', priceQuery)
    if (price === null) {
      return
    }

    return normalizedAmount * price
  }
}

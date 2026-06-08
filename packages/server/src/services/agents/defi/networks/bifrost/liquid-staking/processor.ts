import {
  filter,
  firstValueFrom,
  map,
  mergeMap,
  Observable,
  Subject,
  Subscription,
  share,
  toArray,
} from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { AggregatedPriceData } from '@/services/agents/ticker/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import {
  Block,
  BlockEvent,
  Event,
  EventRecordWithIndex,
  getTimestampFromBlock,
  storageEntriesAtLatest$,
} from '@/services/networking/substrate/index.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import {
  DefiEventPayload,
  DefiLiquidityAsset,
  DefiLiquidityPayload,
  DefiSubscriptionPayload,
} from '../../../types.js'
import { CHAIN_ID, SLP_V2_PROTOCOL_NAME } from '../consts.js'
import {
  LstMarketBase,
  StakingDelegator,
  StakingProtocol,
  TokenId,
  VtokenMintedEvent,
  VtokenRedeemedEvent,
} from './types.js'

const PRECISION = 10 ** 12
const VTOKEN_MINT_MODULE = 'vtokenminting'
const VTOKEN_MINT_EVENT = 'minted'
const VTOKEN_REDEEM_EVENT = 'redeemsuccess'

export function createLiquidStakingProcessor({
  logger,
  ingress,
  fetchAssetMetadata,
  fetchPrices,
  subject,
}: {
  logger: Logger
  ingress: IngressConsumers
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>
  fetchPrices: (assets: string[]) => Promise<AggregatedPriceData[]>
  subject: Subject<DefiSubscriptionPayload>
}) {
  const substrateIngress = ingress.substrate
  const lstMarkets: Map<string, LstMarketBase> = new Map()
  const assetMetaMap: Map<string, AssetMetadata> = new Map()
  const tokenPriceMap: Map<string, number> = new Map()

  const subs: Subscription[] = []
  let inFlight = 0

  async function init() {
    try {
      const delegators = await firstValueFrom(
        storageEntriesAtLatest$<[StakingProtocol, number], StakingDelegator>(
          substrateIngress,
          CHAIN_ID,
          'SlpV2',
          'DelegatorByStakingProtocolAndDelegatorIndex',
        ).pipe(toArray()),
      )

      const tokenMappings = await firstValueFrom(
        storageEntriesAtLatest$<[TokenId], TokenId>(
          substrateIngress,
          CHAIN_ID,
          'VtokenMinting',
          'TokenToVToken',
        ).pipe(toArray()),
      )

      const vtokenMap = new Map<string, { id: TokenId; melbourned: string }>()

      for (const { key, value } of tokenMappings) {
        const tokenId = toMelbourne(key[0]).toLowerCase()

        vtokenMap.set(tokenId, {
          id: value,
          melbourned: toMelbourne(value).toLowerCase(),
        })
      }

      const assetIds = [...vtokenMap.entries()].flatMap(([tokenId, vtoken]) => [tokenId, vtoken.melbourned])

      const assetMetas = await fetchAssetMetadata(assetIds)

      for (const meta of assetMetas) {
        assetMetaMap.set(toMelbourne(meta.id).toLowerCase(), meta)
      }

      for (const { key, value } of delegators) {
        const [protocol] = key

        const account = typeof value.value === 'string' ? value.value : value.value.asHex()

        let underlyingId: string
        let stakingNetwork: string

        if (protocol.type === 'EthereumStaking') {
          underlyingId = 'token2:15'
          stakingNetwork = 'urn:ocn:ethereum:1'
        } else if (protocol.type === 'GeneralXCMStaking') {
          const [lst, paraId] = protocol.value
          underlyingId = toMelbourne(lst).toLowerCase()
          stakingNetwork = `urn:ocn:polkadot:${paraId}`
        } else {
          const [lst, networkId] = protocol.value
          underlyingId = toMelbourne(lst).toLowerCase()
          stakingNetwork = `urn:ocn:ethereum:${networkId}`
        }

        const delegator = asPublicKey(account)

        const existingMarket = lstMarkets.get(underlyingId)

        if (existingMarket) {
          existingMarket.delegators.add(delegator)
          continue
        }

        const underlyingMeta = assetMetaMap.get(underlyingId)
        const vtoken = vtokenMap.get(underlyingId)

        if (!vtoken || !underlyingMeta) {
          logger.warn('No token data found %s', underlyingId)
          continue
        }

        const vtokenMeta = assetMetaMap.get(vtoken.melbourned)

        lstMarkets.set(underlyingId, {
          type: protocol.type.toLowerCase(),
          underlying: {
            id: underlyingId,
            sourceId:
              underlyingMeta.sourceId?.chainId && underlyingMeta.sourceId?.id
                ? toAssetId(underlyingMeta.sourceId.chainId, underlyingMeta.sourceId.id)
                : undefined,
            symbol: underlyingMeta.symbol,
            decimals: underlyingMeta.decimals ?? 0,
          },
          lst: {
            id: vtoken.melbourned,
            symbol: vtokenMeta?.symbol,
            decimals: vtokenMeta?.decimals ?? 0,
          },
          delegators: new Set([delegator]),
          stakingNetwork,
        })
      }

      logger.info('[defi:bifrost-slp] slp-v2 markets initialised.')
    } catch (e) {
      logger.error(e, '[defi:bifrost-slp] Error getting markets data.')
    }
  }

  async function onBlock(block: Block) {
    if (inFlight > 0) {
      return
    }

    inFlight++

    try {
      const [stakingTokenCounters, vtokenIssuances] = await Promise.all([
        firstValueFrom(
          storageEntriesAtLatest$<[TokenId], bigint>(
            substrateIngress,
            CHAIN_ID,
            'VtokenMinting',
            'TokenPool',
          ).pipe(toArray()),
        ),
        firstValueFrom(
          storageEntriesAtLatest$<[TokenId], bigint>(
            substrateIngress,
            CHAIN_ID,
            'VtokenMinting',
            'VtokenIssuance',
          ).pipe(toArray()),
        ),
      ])

      const stakingCounterMap = new Map<string, bigint>()
      const vtokenIssuanceMap = new Map<string, bigint>()

      for (const { key, value } of stakingTokenCounters) {
        const stakingTokenId = toMelbourne(key[0]).toLowerCase()
        stakingCounterMap.set(stakingTokenId, value)
      }

      for (const { key, value } of vtokenIssuances) {
        const vTokenId = toMelbourne(key[0]).toLowerCase()
        vtokenIssuanceMap.set(vTokenId, value)
      }

      for (const market of lstMarkets.values()) {
        const { stakingNetwork, underlying, lst } = market
        const stakingTokenId = underlying.id
        const vtokenId = lst.id
        const stakedCount = stakingCounterMap.get(vtokenId)
        const vtokenIssuance = vtokenIssuanceMap.get(vtokenId)
        if (!stakedCount) {
          logger.warn('[defi:bifrost-slp] No staked count for vtoken %s', vtokenId)
          continue
        }
        if (!vtokenIssuance) {
          logger.warn('[defi:bifrost-slp] No issuance for vtoken %s', vtokenId)
          continue
        }
        const prices = await fetchPrices([underlying.symbol, lst.symbol].filter((a) => a !== undefined))
        const stakedTokenPriceData = prices.find(
          (p) => p.ticker.toLowerCase() === underlying.symbol?.toLowerCase(),
        )
        const vTokenPriceData = prices.find((p) => p.ticker.toLowerCase() === lst.symbol?.toLowerCase())

        if (!stakedTokenPriceData) {
          logger.warn(
            '[defi:bifrost-slp] No price found for staked token %s (symbol=%s)',
            stakingTokenId,
            underlying.symbol,
          )
          continue
        }

        tokenPriceMap.set(stakingTokenId, stakedTokenPriceData.medianPrice)
        if (vTokenPriceData) {
          tokenPriceMap.set(vtokenId, vTokenPriceData.medianPrice)
        }

        const totalStaked = formatUnits(stakedCount, underlying.decimals)
        const stPrice = stakedTokenPriceData.medianPrice
        const suppliedUSD = Number(totalStaked) * stPrice

        const totalIssued = formatUnits(vtokenIssuance, lst.decimals)
        const vtPrice = vTokenPriceData?.medianPrice ?? 0

        const exchangeRate = Number((stakedCount * BigInt(PRECISION)) / vtokenIssuance) / PRECISION

        const assets: DefiLiquidityAsset[] = [
          {
            assetId: toAssetId(CHAIN_ID, underlying.id),
            decimals: underlying.decimals,
            symbol: underlying.symbol ?? '??',
            priceUSD: stPrice,
            balances: {
              reserves: totalStaked,
            },
            role: 'staked',
          },
          {
            assetId: toAssetId(CHAIN_ID, lst.id),
            decimals: lst.decimals,
            symbol: lst.symbol ?? '??',
            priceUSD: vtPrice,
            balances: {
              reserves: totalIssued,
            },
            role: 'lst',
          },
        ]

        const lstLiquidityEvent: DefiLiquidityPayload = {
          type: 'liquidity',
          networkId: CHAIN_ID,
          protocol: SLP_V2_PROTOCOL_NAME,
          marketId: vtokenId,
          category: 'liquid-staking',
          suppliedUSD,
          assets,
          liquidStaking: {
            stakingNetwork,
            totalStaked,
            exchangeRate,
          },
        }

        subject.next(lstLiquidityEvent)
      }
    } catch (e) {
      logger.error(e, '[defi:bifrost-slp] Error processing block %s (#%s)', block.hash, block.number)
    } finally {
      inFlight--
    }
  }

  function watchEvents() {
    return (source$: Observable<Block>): Observable<DefiEventPayload> =>
      source$.pipe(
        mergeMap(({ events, extrinsics, hash, number, specVersion }) => {
          const timestamp = getTimestampFromBlock(extrinsics)
          const eventsWithIndex: EventRecordWithIndex<Event>[] = events.map((e, i) => ({ ...e, index: i }))
          return eventsWithIndex.map(({ event, phase, index }) => {
            const isApplyExtrinsic = phase.type === 'ApplyExtrinsic'
            const extrinsic = isApplyExtrinsic ? extrinsics[phase.value] : undefined
            return {
              ...event,
              extrinsic,
              blockNumber: number,
              blockHash: hash,
              blockPosition: index,
              specVersion,
              timestamp,
            } as BlockEvent
          })
        }),
        filter(
          (e) =>
            e.module.toLowerCase() === VTOKEN_MINT_MODULE &&
            [VTOKEN_MINT_EVENT, VTOKEN_REDEEM_EVENT].includes(e.name.toLowerCase()),
        ),
        map((e) => {
          if (e.name.toLowerCase() === VTOKEN_REDEEM_EVENT) {
            const { currency_amount, currency_id, redeemer } = e.value as VtokenRedeemedEvent
            const stakingTokenId = toMelbourne(currency_id).toLowerCase()
            const market = lstMarkets.get(stakingTokenId)
            if (!market) {
              return null
            }
            const redeemedAmount = formatUnits(currency_amount, market.underlying.decimals)
            const price = tokenPriceMap.get(stakingTokenId)
            const amountUSD = price ? price * Number(redeemedAmount) : undefined

            const payload: DefiEventPayload = {
              id: ulid(),
              type: 'event',
              name: 'lst_redeem',
              networkId: CHAIN_ID,
              protocol: SLP_V2_PROTOCOL_NAME,
              marketId: market.lst.id,
              blockHash: e.blockHash,
              blockNumber: e.blockNumber.toString(),
              txHash: e.extrinsic?.hash ?? null,
              data: {
                provider: asPublicKey(redeemer),
                assets: [
                  {
                    amount: redeemedAmount,
                    assetId: toAssetId(CHAIN_ID, stakingTokenId),
                    symbol: market.underlying.symbol ?? '??',
                    amountUSD,
                  },
                ],
              },
            }
            return payload
          }
          if (e.name.toLowerCase() === VTOKEN_MINT_EVENT) {
            const { currency_amount, currency_id, minter, v_currency_amount } = e.value as VtokenMintedEvent
            const stakingTokenId = toMelbourne(currency_id).toLowerCase()
            const market = lstMarkets.get(stakingTokenId)
            if (!market) {
              return null
            }
            const suppliedAmount = formatUnits(currency_amount, market.underlying.decimals)
            const supplyPrice = tokenPriceMap.get(stakingTokenId)
            const suppliedUSD = supplyPrice ? supplyPrice * Number(suppliedAmount) : undefined

            const mintedAmount = formatUnits(v_currency_amount, market.lst.decimals)
            const mintPrice = tokenPriceMap.get(market.lst.id)
            const mintedUSD = mintPrice ? mintPrice * Number(mintedAmount) : undefined

            const payload: DefiEventPayload = {
              id: ulid(),
              type: 'event',
              name: 'lst_mint',
              networkId: CHAIN_ID,
              protocol: SLP_V2_PROTOCOL_NAME,
              marketId: market.lst.id,
              blockHash: e.blockHash,
              blockNumber: e.blockNumber.toString(),
              txHash: e.extrinsic?.hash ?? null,
              data: {
                provider: asPublicKey(minter),
                supplied: {
                  amount: suppliedAmount,
                  assetId: toAssetId(CHAIN_ID, stakingTokenId),
                  symbol: market.underlying.symbol ?? '??',
                  amountUSD: suppliedUSD,
                },
                minted: {
                  amount: mintedAmount,
                  assetId: toAssetId(CHAIN_ID, market.lst.id),
                  symbol: market.lst.symbol ?? '??',
                  amountUSD: mintedUSD,
                },
              },
            }
            return payload
          }
          return null
        }),
        filter((p) => p !== null),
      )
  }

  async function start(block$: Observable<Block>) {
    await init()
    const events$ = block$.pipe(watchEvents(), share())

    // Events
    subs.push(events$.subscribe((payload) => subject.next(payload)))

    // Liquidity
    subs.push(
      block$
        .pipe(
          smartTrigger<Block>({
            events$,
            maxStaleBlocks: 50,
          }),
        )
        .subscribe((block) => onBlock(block)),
    )
    logger.info('[defi:bifrost-slp] Processor started.')
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0
    logger.info('[defi:bifrost-slp] Processor stopped.')
  }

  return {
    start,
    stop,
  }
}

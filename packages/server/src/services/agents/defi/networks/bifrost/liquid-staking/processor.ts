import { filter, firstValueFrom, Observable, Subject, Subscription, share, toArray } from 'rxjs'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { AggregatedPriceData } from '@/services/agents/ticker/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Block, storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import { DefiLiquidityAsset, DefiLiquidityPayload, DefiSubscriptionPayload } from '../../../types.js'
import { CHAIN_ID, SLP_V2_PROTOCOL_NAME } from '../consts.js'
import { LstMarketBase, StakingDelegator, StakingProtocol, TokenId } from './types.js'

const PRECISION = 10 ** 12

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

        if (protocol.type !== 'GeneralXCMStaking') {
          continue
        }

        const account = typeof value.value === 'string' ? value.value : value.value.asHex()

        const [lst, paraId] = protocol.value
        const underlyingId = toMelbourne(lst).toLowerCase()

        const marketKey = `${protocol.type.toLowerCase()}.${paraId}:${underlyingId}`
        const delegator = asPublicKey(account)

        const existingMarket = lstMarkets.get(marketKey)

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

        lstMarkets.set(marketKey, {
          type: protocol.type.toLowerCase(),
          underlying: {
            id: lst,
            sourceId:
              underlyingMeta.sourceId?.chainId && underlyingMeta.sourceId?.id
                ? toAssetId(underlyingMeta.sourceId.chainId, underlyingMeta.sourceId.id)
                : undefined,
            symbol: underlyingMeta.symbol,
            decimals: underlyingMeta.decimals ?? 0,
          },
          lst: {
            id: vtoken.id,
            symbol: vtokenMeta?.symbol,
            decimals: vtokenMeta?.decimals ?? 0,
          },
          delegators: new Set([delegator]),
          stakingNetwork: `urn:ocn:polkadot:${paraId}`,
        })
      }

      logger.info('[defi:bifrost] LST markets initialised.')
    } catch (e) {
      logger.error(e, '[defi:bifrost] Error getting markets data.')
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
        const stakingTokenId = toMelbourne(underlying.id).toLowerCase()
        const vtokenId = toMelbourne(lst.id).toLowerCase()
        const stakedCount = stakingCounterMap.get(vtokenId)
        const vtokenIssuance = vtokenIssuanceMap.get(vtokenId)
        if (!stakedCount) {
          logger.warn('[defi:bifrost] No staked count for vtoken %s', vtokenId)
          continue
        }
        if (!vtokenIssuance) {
          logger.warn('[defi:bifrost] No issuance for vtoken %s', vtokenId)
          continue
        }
        const prices = await fetchPrices([underlying.symbol, lst.symbol].filter((a) => a !== undefined))
        const stakedTokenPriceData = prices.find(
          (p) => p.ticker.toLowerCase() === underlying.symbol?.toLowerCase(),
        )
        const vTokenPriceData = prices.find((p) => p.ticker.toLowerCase() === lst.symbol?.toLowerCase())

        if (!stakedTokenPriceData) {
          logger.warn(
            '[defi:bifrost] No price found for staked token %s (symbol=%s)',
            stakingTokenId,
            underlying.symbol,
          )
          continue
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
      logger.error(e, '[defi:bifrost] Error processing block %s (#%s)', block.hash, block.number)
    } finally {
      inFlight--
    }
  }

  async function start(block$: Observable<Block>) {
    await init()
    const events$ = block$.pipe(
      // watchEvents(logger, fetchAssetMetadata, fetchAccounts, computeUsdValue),
      filter(({ events }) => events.length > 100),
      share(),
    )
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
    logger.info('[defi:bifrost] Processor started.')
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0
  }

  return {
    start,
    stop,
  }
}

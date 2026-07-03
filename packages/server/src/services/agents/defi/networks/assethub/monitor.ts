import { filter, firstValueFrom, Subject, Subscription, share, switchMap, toArray } from 'rxjs'
import { formatUnits } from 'viem'
import { asJSON } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { AssetMetadata, isAssetMetadata } from '@/services/agents/steward/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Block, storageEntriesAtLatest$, XcmLocation } from '@/services/networking/substrate/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../rxjs/trigger.js'
import { DefiLiquidityPayload, DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID, chunk, MAX_BATCH_SIZE, PROTOCOL, WHITELISTED_LOCAL_ASSETS } from './common.js'
import { watchEvents } from './events.js'
import { calculatePoolPrices } from './prices.js'
import { createReservesWatcher } from './reserves.js'
import {
  AssetConversionPool,
  AssetConversionPoolReserves,
  BaseAssetMetadata,
  PoolAssetsAssetValue,
} from './types.js'

function resolveToken(
  location: XcmLocation,
  metadataMap: Map<string, AssetMetadata>,
): BaseAssetMetadata | null {
  if (location.parents === 0 && location.interior.type === 'X2') {
    const assetIdJunction = location.interior.value.find((j) => j.type === 'GeneralIndex')

    if (!assetIdJunction) {
      return null
    }

    const assetId = Number(assetIdJunction.value)
    const metadata = metadataMap.get(String(assetId))

    return {
      type: 'local',
      chainId: CHAIN_ID,
      id: assetId,
      location,
      decimals: metadata?.decimals,
      symbol: metadata?.symbol,
    }
  }

  const metadata = metadataMap.get(asJSON(location))

  if (!metadata) {
    return null
  }

  return {
    type: 'foreign',
    chainId: metadata.chainId,
    id: metadata.id,
    location,
    decimals: metadata.decimals,
    symbol: metadata.symbol,
  }
}

export function assethubDexMonitor(
  logger: Logger,
  _ingress: IngressConsumers,
  deps: DefiMonitorDependencies,
) {
  const subject = new Subject<DefiSubscriptionPayload>()
  const subs: Subscription[] = []
  const ingress = _ingress.substrate
  const poolMap = new Map<string, AssetConversionPool>()
  const tokenMetadataMap = new Map<string, AssetMetadata>()

  const { mapReserves } = createReservesWatcher(logger, ingress)

  async function loadTokenMetadata(poolTokenLocations: [XcmLocation, XcmLocation][]) {
    try {
      const numericAssetIds = new Set<string>()
      const locationIds = new Set<string>()

      for (const [baseLocation, quoteLocation] of poolTokenLocations) {
        for (const location of [baseLocation, quoteLocation]) {
          if (location.parents === 0 && location.interior.type === 'X2') {
            const assetIdJunction = location.interior.value.find((j) => j.type === 'GeneralIndex')

            if (assetIdJunction) {
              numericAssetIds.add(String(assetIdJunction.value))
              continue
            }
          }

          locationIds.add(asJSON(location))
        }
      }

      const locationIdsList = [...locationIds]
      const numericAssetIdsList = [...numericAssetIds]

      const numericMetadata = await Promise.all(
        chunk(numericAssetIdsList, MAX_BATCH_SIZE).map((batch) => deps.fetchAssetMetadata(CHAIN_ID, batch)),
      ).then((results) => results.flat())

      const locationMetadata = await Promise.all(
        chunk(locationIdsList, MAX_BATCH_SIZE).map((batch) =>
          deps.fetchAssetMetadataByLocation(CHAIN_ID, batch),
        ),
      ).then((results) => results.flat())

      for (const metadata of numericMetadata) {
        tokenMetadataMap.set(String(metadata.id), metadata)
      }

      locationIdsList.forEach((location, i) => {
        const metadata = locationMetadata[i]
        if (isAssetMetadata(metadata)) {
          tokenMetadataMap.set(location, metadata)
        }
      })
    } catch (error) {
      logger.error(error, '[defi:assethub] Error loading asset metadata')
    }
  }

  async function loadPools() {
    const [poolEntries, poolInfoEntries] = await Promise.all([
      firstValueFrom(
        storageEntriesAtLatest$<[[XcmLocation, XcmLocation]], number>(
          ingress,
          CHAIN_ID,
          'AssetConversion',
          'Pools',
        ).pipe(toArray()),
      ),
      firstValueFrom(
        storageEntriesAtLatest$<[number], PoolAssetsAssetValue>(
          ingress,
          CHAIN_ID,
          'PoolAssets',
          'Asset',
        ).pipe(toArray()),
      ),
    ])

    await loadTokenMetadata(poolEntries.map(({ key }) => key[0]))

    const poolInfoMap = new Map(poolInfoEntries.map((e) => [e.key[0], e.value]))

    for (const { key, value: poolTokenId } of poolEntries) {
      const [baseLocation, quoteLocation] = key[0]

      const baseToken = resolveToken(baseLocation, tokenMetadataMap)
      const quoteToken = resolveToken(quoteLocation, tokenMetadataMap)

      const poolInfo = poolInfoMap.get(poolTokenId)

      if (!baseToken || !quoteToken || !poolInfo) {
        logger.warn('[defi:assethub] no quote token  found for location=%s', asJSON(quoteLocation))
        continue
      }
      if (quoteToken.type === 'local' && !WHITELISTED_LOCAL_ASSETS.includes(quoteToken.id as number)) {
        continue
      }

      poolMap.set(String(poolTokenId), {
        chainId: CHAIN_ID,
        poolTokenId,
        owner: poolInfo.owner,
        baseToken,
        quoteToken,
      })
    }

    logger.info('[defi:assethub] %s pools loaded.', poolMap.size)
  }

  function onBlock(poolReservesMap: Map<string, AssetConversionPoolReserves>) {
    const { prices, getPrice } = calculatePoolPrices(poolReservesMap)

    for (const [assetId, { price, decimals, symbol }] of prices) {
      subject.next({
        type: 'price',
        assetId,
        networkId: CHAIN_ID,
        protocol: PROTOCOL,
        priceUSD: price.toString(),
        updatedAt: Date.now(),
        decimals,
        symbol: symbol ?? '??',
      })
    }

    for (const pool of poolReservesMap.values()) {
      const { baseToken, quoteToken } = pool

      const baseTokenDecimals = baseToken.decimals ?? 0
      const quoteTokenDecimals = quoteToken.decimals ?? 0

      const baseTokenPrice = getPrice(baseToken)?.price ?? 0
      const quoteTokenPrice = getPrice(quoteToken)?.price ?? 0

      const baseReserves = formatUnits(baseToken.reserves, baseTokenDecimals)
      const quoteReserves = formatUnits(quoteToken.reserves, quoteTokenDecimals)

      const suppliedUSD = Number(baseReserves) * baseTokenPrice + Number(quoteReserves) * quoteTokenPrice

      const payload: DefiLiquidityPayload = {
        type: 'liquidity',
        networkId: CHAIN_ID,
        category: 'exchange',
        marketId: pool.owner,
        protocol: PROTOCOL,
        suppliedUSD,
        assets: [
          {
            assetId: toAssetId(baseToken.chainId, pool.baseToken.id),
            decimals: baseTokenDecimals,
            symbol: pool.baseToken.symbol ?? '??',
            balances: {
              reserves: baseReserves,
            },
            priceUSD: baseTokenPrice,
          },
          {
            assetId: toAssetId(pool.quoteToken.chainId, pool.quoteToken.id),
            decimals: quoteTokenDecimals,
            symbol: pool.quoteToken.symbol ?? '??',
            balances: {
              reserves: quoteReserves,
            },
            priceUSD: quoteTokenPrice,
          },
        ],
      }

      subject.next(payload)
    }
  }

  async function start() {
    logger.info('[defi:assethub] starting monitor...')
    const shared$ = SubstrateSharedStreams.instance(ingress)
    const block$ = shared$.blocks(CHAIN_ID).pipe(filter((b) => b.ingestionMode !== 'backfill'))
    const events$ = block$.pipe(watchEvents(), share())
    const apiCtx$ = ingress.getContext(CHAIN_ID)

    await loadPools()

    const liquidity$ = apiCtx$.pipe(
      switchMap((apiCtx) =>
        block$.pipe(
          smartTrigger<Block>({
            events$,
            maxStaleBlocks: 150,
          }),
          mapReserves(apiCtx, poolMap),
        ),
      ),
    )
    // Liquidity
    subs.push(liquidity$.subscribe(onBlock))
    logger.info('[defi:assethub] monitor started.')
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
    chainId: CHAIN_ID,
    config: {
      evm: false,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}

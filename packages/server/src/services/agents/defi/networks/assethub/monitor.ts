import { filter, firstValueFrom, Subject, Subscription, share, switchMap, toArray } from 'rxjs'
import { formatUnits } from 'viem'
import { toAssetId } from '@/services/agents/common/assets.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Block, storageEntriesAtLatest$, XcmLocation } from '@/services/networking/substrate/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../rxjs/trigger.js'
import { DefiLiquidityPayload, DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import {
  BASE_TOKEN_LOCATION,
  CHAIN_ID,
  chunk,
  getLocalAssetId,
  isLocalAsset,
  locationToIdString,
  MAX_BATCH_SIZE,
  PRICE_EMISSION_THRESHOLD,
  PROTOCOL,
  WHITELISTED_LOCAL_ASSETS,
} from './common.js'
import { createEventWatcher } from './events.js'
import { calculatePoolPrices } from './prices.js'
import { createReservesWatcher } from './reserves.js'
import {
  AssetConversionPool,
  AssetConversionPoolReserves,
  AssetIdentifier,
  BaseAssetMetadata,
  PoolAssetsAssetValue,
} from './types.js'

const MAX_PRICE_UPDATE_INTERVAL = 30 * 60_000

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
  const priceMap = new Map<string, { price: number; updatedAt: number }>()

  const getPrice = (token: AssetIdentifier) => {
    return priceMap.get(toAssetId(token.chainId, token.id))?.price
  }

  const getPool = (quoteToken: XcmLocation) => {
    return poolMap.get(locationToIdString(quoteToken))
  }

  const getMetadata = (location: XcmLocation) => {
    if (isLocalAsset(location)) {
      const id = getLocalAssetId(location)
      return tokenMetadataMap.get(String(id))
    }
    const locationString = locationToIdString(location)
    return tokenMetadataMap.get(locationString)
  }

  const { mapReserves } = createReservesWatcher(logger, ingress)
  const { watchEvents } = createEventWatcher({
    logger,
    getPrice,
    getPool,
    getMetadata,
  })

  async function loadPriceData() {
    const latestPrices = await deps.listLatestPrices(CHAIN_ID)
    if (latestPrices.length === 0) {
      logger.info('[defi:assethub] No prices data in db.')
      return
    }
    for (const { assetId, priceUSD } of latestPrices) {
      priceMap.set(assetId, { price: Number(priceUSD), updatedAt: Date.now() })
    }
    logger.info('[defi:assethub] Latest prices loaded.')
  }

  function resolveToken(location: XcmLocation): BaseAssetMetadata | null {
    if (isLocalAsset(location)) {
      const assetId = getLocalAssetId(location)

      if (assetId === undefined) {
        return null
      }

      const metadata = tokenMetadataMap.get(String(assetId))

      return {
        type: 'local',
        chainId: CHAIN_ID,
        id: String(assetId),
        location,
        decimals: metadata?.decimals,
        symbol: metadata?.symbol,
      }
    }

    const locationId = locationToIdString(location)
    const metadata = tokenMetadataMap.get(locationId)

    if (!metadata) {
      return null
    }

    return {
      type: 'foreign',
      chainId: metadata.chainId,
      id: normalizeAssetId(metadata.id),
      location,
      decimals: metadata.decimals,
      symbol: metadata.symbol,
    }
  }

  async function loadTokenMetadata(poolTokenLocations: [XcmLocation, XcmLocation][]) {
    try {
      const assetIds = new Set<string>()

      for (const [_baseLocation, quoteLocation] of poolTokenLocations) {
        if (!assetIds.has('native')) {
          assetIds.add('native')
        }

        if (isLocalAsset(quoteLocation)) {
          const assetId = getLocalAssetId(quoteLocation)

          if (assetId) {
            assetIds.add(String(assetId))
          }
        } else {
          assetIds.add(locationToIdString(quoteLocation))
        }
      }

      const assetIdsList = [...assetIds]

      const numericMetadata = await Promise.all(
        chunk(assetIdsList, MAX_BATCH_SIZE).map((batch) => deps.fetchAssetMetadata(CHAIN_ID, batch)),
      ).then((results) => results.flat())

      for (const metadata of numericMetadata) {
        if (metadata.chainId === CHAIN_ID && metadata.id === 'native') {
          tokenMetadataMap.set(normalizeAssetId(BASE_TOKEN_LOCATION), metadata)
          continue
        }
        tokenMetadataMap.set(normalizeAssetId(metadata.id), metadata)
      }
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

      const baseToken = resolveToken(baseLocation)
      const quoteToken = resolveToken(quoteLocation)

      const poolInfo = poolInfoMap.get(poolTokenId)

      if (!baseToken || !quoteToken || !poolInfo) {
        continue
      }

      if (quoteToken.type === 'local' && !WHITELISTED_LOCAL_ASSETS.includes(quoteToken.id)) {
        continue
      }

      poolMap.set(locationToIdString(quoteLocation), {
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
    const prices = calculatePoolPrices(poolReservesMap)

    for (const [assetId, { price, decimals, symbol }] of prices) {
      const prev = priceMap.get(assetId)
      const now = Date.now()

      if (prev !== undefined) {
        const diff = Math.abs(price - prev.price) / prev.price
        const elapsedMs = now - prev.updatedAt
        if (diff < PRICE_EMISSION_THRESHOLD && elapsedMs < MAX_PRICE_UPDATE_INTERVAL) {
          continue
        }
      }

      priceMap.set(assetId, { price, updatedAt: now })
      subject.next({
        type: 'price',
        assetId,
        networkId: CHAIN_ID,
        protocol: PROTOCOL,
        priceUSD: price.toString(),
        updatedAt: now,
        decimals,
        symbol: symbol ?? '??',
      })
    }

    for (const pool of poolReservesMap.values()) {
      const { baseToken, quoteToken } = pool

      const baseTokenDecimals = baseToken.decimals ?? 0
      const quoteTokenDecimals = quoteToken.decimals ?? 0

      const baseTokenPrice = getPrice(baseToken) ?? 0
      const quoteTokenPrice = getPrice(quoteToken) ?? 0

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

    await loadPriceData()
    await loadPools()

    const shared$ = SubstrateSharedStreams.instance(ingress)
    const block$ = shared$.blocks(CHAIN_ID).pipe(filter((b) => b.ingestionMode !== 'backfill'))
    const events$ = block$.pipe(watchEvents(), share())
    const apiCtx$ = ingress.getContext(CHAIN_ID)

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

    // Events
    subs.push(events$.subscribe((payload) => subject.next(payload)))

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

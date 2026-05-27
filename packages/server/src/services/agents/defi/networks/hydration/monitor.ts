import { firstValueFrom, map, Subject, Subscription, share } from 'rxjs'
import { formatUnits } from 'viem'
import { SubstrateAccountMetadata } from '@/services/agents/steward/lib.js'
import { AssetMetadata, Empty } from '@/services/agents/steward/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../rxjs/trigger.js'
import {
  DefiEventAsset,
  DefiEventPayload,
  DefiLiquidityAsset,
  DefiPricePayload,
  DefiSubscriptionPayload,
  isLiquidationEvent,
  isSwapEvent,
} from '../../types.js'
import { CHAIN_ID } from './consts.js'
import { watchEvents } from './events/watcher.js'
import { createPoolManager } from './pools/manager.js'
import { calculateSpot } from './pricing/index.js'
import { buildGraph, getSwapPath } from './routing.js'
import { AavePool, AaveToken, HsmPool, Path, Pool } from './types.js'
import { bigintToUsd, toProtocol } from './utils.js'

const DEFAULT_QUOTE_TOKEN = 10
const PRICE_EMISSION_THRESHOLD = 0.0001

export function hydrationDexMonitor(
  logger: Logger,
  ingress: IngressConsumers,
  {
    fetchAccounts,
    fetchAssetMetadata: fetchAssetMeta,
    listLatestPrices,
  }: {
    fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>
    fetchAssetMetadata: (network: string, assets: string[]) => Promise<AssetMetadata[]>
    listLatestPrices: (network: string) => Promise<DefiPricePayload[]>
  },
) {
  const fetchAssetMetadata = (assets: string[]) => fetchAssetMeta(CHAIN_ID, assets)

  const poolsManager = createPoolManager(logger, ingress, fetchAssetMetadata)

  const subject = new Subject<DefiSubscriptionPayload>()

  const allTokens = new Set<number>()
  const cachedPaths: Map<number, Path | null> = new Map()
  const prices: Map<number, number> = new Map()

  const subs: Subscription[] = []
  let inFlight = 0
  let initialised = false

  async function loadData() {
    const latestPrices = await listLatestPrices(CHAIN_ID)
    if (latestPrices.length === 0) {
      logger.info('[dex:hydration] No prices data in db.')
      return
    }
    for (const { assetId, priceUSD } of latestPrices) {
      try {
        const numericId = Number(assetId)
        allTokens.add(numericId)
        prices.set(numericId, Number(priceUSD))
      } catch (e) {
        logger.warn(e, `Error loading data for asset: ${assetId}`)
      }
    }
    logger.info('[dex:hydration] Latest prices loaded.')
  }

  async function initialise(latestBlock: Block) {
    await poolsManager.init(latestBlock)

    const allPools: Pool[] = poolsManager.getSwappablePools()
    for (const pool of allPools) {
      for (const token of pool.tokens) {
        if (!allTokens.has(token.id)) {
          allTokens.add(token.id)
        }
      }
    }

    const graph = buildGraph(allPools)
    for (const token of allTokens) {
      if (!cachedPaths.has(token)) {
        cachedPaths.set(token, getSwapPath(graph, token, DEFAULT_QUOTE_TOKEN))
      }
    }

    initialised = true
  }

  async function updatePrices() {
    for (const [asset, path] of cachedPaths) {
      if (!path) {
        logger.warn('[dex:hydration] No path found for asset %s', asset)
        continue
      }
      try {
        const spot = asset === DEFAULT_QUOTE_TOKEN ? 1 : calculateSpot(poolsManager, path)
        if (spot) {
          const prevPrice = prices.get(asset)

          if (prevPrice !== undefined) {
            const diff = Math.abs(spot - prevPrice) / prevPrice
            if (diff < PRICE_EMISSION_THRESHOLD) {
              continue
            }
          }

          prices.set(asset, spot)

          const metaResult = await fetchAssetMetadata([asset.toString()])
          const meta = metaResult.length > 0 ? metaResult[0] : null
          subject.next({
            type: 'price',
            assetId: asset.toString(),
            networkId: CHAIN_ID,
            protocol: toProtocol('router'),
            priceUSD: spot.toString(),
            updatedAt: Date.now(),
            decimals: meta?.decimals ?? 0,
            symbol: meta?.symbol ?? '??',
          })
        } else {
          logger.warn('[dex:hydration] No spot price calculated for asset %s', asset)
        }
      } catch (e) {
        logger.error(e, '[dex:hydration] Error updating price for asset %s', asset)
      }
    }
  }

  function emitMMLiquidityEvent(pool: AavePool) {
    const underlying = pool.tokens.find((t: AaveToken) => t.isUnderlying)
    if (!underlying) {
      logger.warn(`[dex:hydration] No underlying token found in AAVE pool ${pool.address}`)
      return
    }
    const reserves = formatUnits(underlying.reserves, underlying.decimals ?? 0)
    const assetPrice = prices.get(underlying.id) ?? pool.oraclePrice
    const suppliedUSD = bigintToUsd(underlying.reserves, underlying.decimals, assetPrice)

    subject.next({
      type: 'liquidity',
      category: 'money-market',
      protocol: toProtocol(pool.type),
      networkId: CHAIN_ID,
      marketId: pool.address,
      suppliedUSD,
      lending: pool.details,
      assets: [
        {
          assetId: underlying.id.toString(),
          symbol: underlying.symbol ?? '??',
          decimals: underlying.decimals,
          priceUSD: assetPrice,
          balances: {
            total: reserves,
            reserves,
            available: formatUnits(underlying.available, underlying.decimals ?? 0),
            borrowed: formatUnits(underlying.borrowed, underlying.decimals ?? 0),
          },
          role: 'collateral',
        },
      ],
    })
  }

  function emitLiquidityEvent(pool: Pool) {
    const liquidityAssets: DefiLiquidityAsset[] = []
    let suppliedUSD = 0
    for (const asset of pool.tokens) {
      const assetPrice = prices.get(asset.id) ?? 0
      const reserves = formatUnits(asset.reserves, asset.decimals ?? 0)
      const assetReservesUSD = bigintToUsd(asset.reserves, asset.decimals, assetPrice)
      suppliedUSD += assetReservesUSD
      liquidityAssets.push({
        assetId: asset.id.toString(),
        symbol: asset.symbol ?? '??',
        decimals: asset.decimals,
        priceUSD: assetPrice,
        balances: {
          total: reserves,
          reserves,
        },
        role: 'liquid',
      })
    }

    subject.next({
      type: 'liquidity',
      networkId: CHAIN_ID,
      category: 'exchange',
      protocol: toProtocol(pool.type),
      marketId: pool.address,
      suppliedUSD,
      assets: liquidityAssets,
    })
  }

  function emitStabilityEvent(pool: HsmPool) {
    const liquidityAssets: DefiLiquidityAsset[] = []
    let suppliedUSD = 0

    for (const asset of pool.tokens) {
      const assetPrice = prices.get(asset.id) ?? 0
      const reserves = formatUnits(asset.reserves, asset.decimals ?? 0)
      const assetReservesUSD = bigintToUsd(asset.reserves, asset.decimals, assetPrice)

      if (asset.isCollateral) {
        suppliedUSD += assetReservesUSD
        liquidityAssets.push({
          assetId: asset.id.toString(),
          symbol: asset.symbol ?? '??',
          decimals: asset.decimals,
          priceUSD: assetPrice,
          balances: {
            total: reserves,
            reserves,
            holdingCap: asset.maxInHolding.toString(),
          },
          role: 'collateral',
        })
      } else {
        liquidityAssets.push({
          assetId: asset.id.toString(),
          symbol: asset.symbol ?? '??',
          decimals: asset.decimals,
          priceUSD: assetPrice,
          balances: {
            total: reserves,
            reserves,
            mintCap: asset.mintCap.toString(),
          },
          role: 'debt',
        })
      }
    }

    subject.next({
      type: 'liquidity',
      networkId: CHAIN_ID,
      category: 'stability',
      protocol: toProtocol(pool.type),
      marketId: pool.address,
      suppliedUSD,
      assets: liquidityAssets,
    })
  }

  function withUsdValue(asset: DefiEventAsset): DefiEventAsset {
    return {
      ...asset,
      amountUSD: Number(asset.amount) * (prices.get(Number(asset.assetId)) ?? 0),
    }
  }

  async function onBlock(block: Block) {
    if (!initialised || inFlight > 0) {
      return
    }

    inFlight++

    try {
      await poolsManager.updateReserves(block)
      await updatePrices()

      poolsManager.getLiquidityPools().forEach(emitLiquidityEvent)
      poolsManager.getPools('aave').forEach(emitMMLiquidityEvent)
      poolsManager.getPools('hsm').forEach(emitStabilityEvent)
    } finally {
      inFlight--
    }
  }

  async function start() {
    await loadData()

    const shared$ = SubstrateSharedStreams.instance(ingress.substrate)
    const blocks$ = shared$.blocks(CHAIN_ID)
    const events$ = blocks$.pipe(
      watchEvents(logger, fetchAssetMetadata, fetchAccounts),
      map((payload) => {
        if (isSwapEvent(payload)) {
          const swapIn = payload.data.in
          const swapOut = payload.data.out

          return {
            ...payload,
            data: {
              ...payload.data,
              in: withUsdValue(swapIn),
              out: withUsdValue(swapOut),
            },
          } as DefiEventPayload
        }
        if (isLiquidationEvent(payload)) {
          const debt = payload.data.debt
          const collateral = payload.data.collateral
          return {
            ...payload,
            data: {
              ...payload.data,
              debt: withUsdValue(debt),
              collateral: withUsdValue(collateral),
            },
          } as DefiEventPayload
        }

        const assetsWithVolume = payload.data.assets.map(withUsdValue)
        return {
          ...payload,
          data: {
            ...payload.data,
            assets: assetsWithVolume,
          },
        }
      }),
      share(),
    )

    subs.push(events$.subscribe((payload) => subject.next(payload)))
    logger.info('[dex:hydration] Subscribed to events.')

    const latestBlock = await firstValueFrom(blocks$)
    await initialise(latestBlock)
    logger.info('[dex:hydration] Initialised pools.')

    subs.push(
      blocks$
        .pipe(
          smartTrigger<Block>({
            events$,
            maxStaleBlocks: 50,
          }),
        )
        .subscribe(onBlock),
    )

    logger.info('[dex:hydration] Subscribed to pool liquidity.')
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
    chainId: CHAIN_ID,
    config: {
      evm: true,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}

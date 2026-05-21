import { EMPTY, firstValueFrom, from, mergeMap, Subject, Subscription } from 'rxjs'
import { formatUnits } from 'viem'
import { toAssetId } from '@/services/agents/common/assets.js'
import { DataSteward } from '@/services/agents/steward/agent.js'
import {
  AssetId,
  AssetMetadata,
  Empty,
  isAssetMetadata,
  StewardQueryArgs,
} from '@/services/agents/steward/types.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload, DefiLiquidityAsset, DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID, PROTOCOL_NAME } from './consts.js'
import { SwapRoute } from './events/types.js'
import { watchEvents } from './events/watcher.js'
import { createPoolManager } from './pools/manager.js'
import { calculateSpot } from './pricing/index.js'
import { buildGraph, getSwapPath } from './routing.js'
import { AavePool, AaveToken, HsmPool, Path, Pool } from './types.js'
import { bigintToUsd } from './utils.js'

const DEFAULT_QUOTE_TOKEN = 10

export function hydrationDexMonitor(logger: Logger, ingress: IngressConsumers, steward: DataSteward) {
  const fetchAssetMetadata = async (assets: string[]): Promise<AssetMetadata[]> => {
    const { items } = (await steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: CHAIN_ID,
            assets,
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    return items.map((i) => (isAssetMetadata(i) ? i : null)).filter((i) => i !== null)
  }

  const poolsManager = createPoolManager(logger, ingress, fetchAssetMetadata)

  const subject = new Subject<DefiSubscriptionPayload>()

  const allTokens = new Set<number>()
  const cachedPaths: Map<number, Path | null> = new Map()
  const prices: Map<number, number> = new Map()

  const subs: Subscription[] = []
  let inFlight = 0
  let initialised = false

  async function initialise(latestBlock: Block) {
    await poolsManager.init(latestBlock)

    const allPools: Pool[] = poolsManager.getSwappablePools()
    for (const pool of allPools) {
      for (const token of pool.tokens) {
        allTokens.add(token.id)
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

  function updatePrices() {
    for (const [asset, path] of cachedPaths) {
      if (!path) {
        logger.warn('[dex:hydration] No path found for asset %s', asset)
        continue
      }
      try {
        const spot = asset === DEFAULT_QUOTE_TOKEN ? 1 : calculateSpot(poolsManager, path)
        if (spot) {
          prices.set(asset, spot)
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
    const reserves = underlying.reserves.toString()
    const assetPrice = prices.get(underlying.id) ?? pool.oraclePrice
    const suppliedUSD = bigintToUsd(underlying.reserves, underlying.decimals, assetPrice)

    subject.next({
      type: 'liquidity',
      category: 'money-market',
      protocol: PROTOCOL_NAME,
      networkId: CHAIN_ID,
      marketId: pool.address,
      suppliedUSD,
      lending: pool.details,
      assets: [
        {
          assetId: toAssetId(CHAIN_ID, underlying.id),
          symbol: underlying.symbol ?? '??',
          decimals: underlying.decimals,
          priceUSD: assetPrice,
          balances: {
            total: reserves,
            reserves,
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
      const reserves = asset.reserves.toString()
      const assetReservesUSD = bigintToUsd(asset.reserves, asset.decimals, assetPrice)
      suppliedUSD += assetReservesUSD
      liquidityAssets.push({
        assetId: toAssetId(CHAIN_ID, asset.id),
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
      protocol: PROTOCOL_NAME,
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
      const reserves = asset.reserves.toString()
      const assetReservesUSD = bigintToUsd(asset.reserves, asset.decimals, assetPrice)

      if (asset.isCollateral) {
        suppliedUSD += assetReservesUSD
        liquidityAssets.push({
          assetId: toAssetId(CHAIN_ID, asset.id),
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
          assetId: toAssetId(CHAIN_ID, asset.id),
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
      protocol: PROTOCOL_NAME,
      marketId: pool.address,
      suppliedUSD,
      assets: liquidityAssets,
    })
  }

  function toSwapEventPayload(
    name: 'swap' | 'swap_intent',
    { assetIn, assetOut, amountIn, amountOut, marketId }: SwapRoute,
    { blockNumber, txHash, who }: { blockNumber: string; txHash: string; who: string },
    metadataMap: Map<AssetId, AssetMetadata>,
  ): DefiEventPayload | null {
    const assetInMeta = metadataMap.get(assetIn)
    const assetOutMeta = metadataMap.get(assetOut)

    if (!assetInMeta || !assetOutMeta) {
      return null
    }

    return {
      type: 'event',
      networkId: CHAIN_ID,
      protocol: PROTOCOL_NAME,
      blockNumber,
      txHash,
      name,
      marketId,
      data: {
        origin: who,
        in: {
          amount: formatUnits(amountIn, assetInMeta.decimals ?? 0),
          assetId: toAssetId(CHAIN_ID, assetIn),
          symbol: assetInMeta.symbol ?? '??',
          amountUSD: bigintToUsd(amountIn, assetInMeta.decimals ?? 0, prices.get(assetIn) ?? 0),
        },
        out: {
          amount: formatUnits(amountOut, assetOutMeta.decimals ?? 0),
          assetId: toAssetId(CHAIN_ID, assetOut),
          symbol: assetOutMeta.symbol ?? '??',
          amountUSD: bigintToUsd(amountOut, assetOutMeta.decimals ?? 0, prices.get(assetOut) ?? 0),
        },
      },
    }
  }

  async function onBlock(block: Block) {
    if (!initialised || inFlight > 0) {
      return
    }

    inFlight++

    try {
      await poolsManager.updateReserves(block)
      updatePrices()

      poolsManager.getLiquidityPools().forEach(emitLiquidityEvent)
      poolsManager.getPools('aave').forEach(emitMMLiquidityEvent)
      poolsManager.getPools('hsm').forEach(emitStabilityEvent)
    } finally {
      inFlight--
    }
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(ingress.substrate)
    const blocks$ = shared$.blocks(CHAIN_ID)
    const events$ = blocks$.pipe(
      watchEvents(logger),
      mergeMap((event) => {
        if (event.type !== 'swap') {
          return EMPTY
        }

        const { assetIn, assetOut, route, blockNumber, extrinsic, who } = event

        const assetIds = [
          ...new Set([
            assetIn.toString(),
            assetOut.toString(),
            ...route.flatMap((r) => [r.assetIn.toString(), r.assetOut.toString()]),
          ]),
        ]

        return from(fetchAssetMetadata(assetIds)).pipe(
          mergeMap((results) => {
            const metadataMap = new Map<AssetId, AssetMetadata>(results.map((meta) => [meta.id, meta]))

            const swapCtx = {
              who,
              blockNumber: blockNumber.toString(),
              txHash: extrinsic?.txHash ?? 'intrinsic',
            }

            const internalSwaps = route
              .map((r) => toSwapEventPayload('swap', r, swapCtx, metadataMap))
              .filter((r): r is DefiEventPayload => r !== null)

            const swapIntentEvent = toSwapEventPayload('swap_intent', event, swapCtx, metadataMap)

            if (swapIntentEvent === null) {
              return [...internalSwaps]
            }

            return [swapIntentEvent, ...internalSwaps]
          }),
        )
      }),
    )
    const latestBlock = await firstValueFrom(blocks$)
    await initialise(latestBlock)

    subs.push(blocks$.subscribe(onBlock))
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

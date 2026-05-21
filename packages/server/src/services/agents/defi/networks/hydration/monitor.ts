import { firstValueFrom, map, Subject, Subscription, share } from 'rxjs'
import { DataSteward } from '@/services/agents/steward/agent.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '@/services/agents/steward/types.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../rxjs/trigger.js'
import { DefiEventPayload, DefiLiquidityAsset, DefiSubscriptionPayload, isSwapEvent } from '../../types.js'
import { CHAIN_ID, PROTOCOL_NAME } from './consts.js'
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
          assetId: underlying.id.toString(),
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
      protocol: PROTOCOL_NAME,
      marketId: pool.address,
      suppliedUSD,
      assets: liquidityAssets,
    })
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
      watchEvents(logger, fetchAssetMetadata),
      map((payload) => {
        if (isSwapEvent(payload)) {
          const swapIn = payload.data.in
          const swapOut = payload.data.out

          return {
            ...payload,
            data: {
              ...payload.data,
              in: {
                ...swapIn,
                amountUSD: Number(swapIn.amount) * (prices.get(Number(swapIn.assetId)) ?? 0),
              },
              out: {
                ...swapOut,
                amountUSD: Number(swapOut.amount) * (prices.get(Number(swapOut.assetId)) ?? 0),
              },
            },
          } as DefiEventPayload
        }
        return payload
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

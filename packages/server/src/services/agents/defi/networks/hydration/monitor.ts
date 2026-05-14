import { firstValueFrom, Subject, Subscription } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { DataSteward } from '@/services/agents/steward/agent.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '@/services/agents/steward/types.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiLiquidityAsset, DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID } from './consts.js'
import { createAaveWatcher } from './pools/aave.js'
import { createOmnipoolWatcher } from './pools/omnipool.js'
import { createStableswapWatcher } from './pools/stableswap.js'
import { createXykWatcher } from './pools/xyk.js'
import { calculateSpot } from './pricing/index.js'
import { buildGraph, getSwapPath } from './routing.js'
import { AavePool, AaveToken, Path, Pool, PoolsContext } from './types.js'
import { bigintToUsd } from './utils.js'

const DEFAULT_QUOTE_TOKEN = 10
const PROTOCOL_NAME = 'hydration'

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

  const substrateIngress = ingress.substrate
  const evmIngress = ingress.evm

  const fetchBalances = hydrationBalancesFetcher(CHAIN_ID, substrateIngress)

  const omnipool = createOmnipoolWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const stableswaps = createStableswapWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const aave = createAaveWatcher(substrateIngress, evmIngress, fetchAssetMetadata)
  const xyk = createXykWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)

  const subject = new Subject<DefiSubscriptionPayload>()
  const pools: PoolsContext = {
    stableswap: [],
    omnipool: null,
    aave: [],
    xyk: [],
  }

  const allTokens = new Set<number>()
  const cachedPaths: Map<number, Path | null> = new Map()
  const prices: Map<number, number> = new Map()

  const subs: Subscription[] = []
  let inFlight = 0
  let initialised = false

  async function initialise(latestBlock: Block) {
    pools.stableswap = await stableswaps.loadPools(latestBlock)
    pools.omnipool = await omnipool.loadPools()
    pools.xyk = await xyk.loadPools()
    pools.aave = await aave.loadPools()

    const allPools: Pool[] = getAllPools()
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

  async function updateReserves(block: Block) {
    pools.xyk = await xyk.updatePoolReserves(pools.xyk)
    pools.omnipool = await omnipool.updatePoolReserves(pools.omnipool)
    pools.stableswap = await stableswaps.updatePoolReserves(pools.stableswap, block)
    pools.aave = await aave.updatePoolReserves(pools.aave)
  }

  function updatePrices() {
    for (const [asset, path] of cachedPaths) {
      if (!path) {
        logger.warn('[dex:hydration] No path found for asset %s', asset)
        continue
      }
      try {
        const spot = asset === DEFAULT_QUOTE_TOKEN ? 1 : calculateSpot(pools, path)
        if (spot) {
          prices.set(asset, spot)
        } else {
          logger.warn('[dex:hydration] No spot price calculated for asset %s', asset)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  function emitMMLiquidityEvent(pool: AavePool) {
    const underlying = pool.tokens.find((t: AaveToken) => t.isUnderlying)
    if (!underlying) {
      logger.warn(`No underlying token found in AAVE pool ${pool.address}`)
      return
    }
    const reserves = underlying.reserves.toString()
    const assetPrice = prices.get(underlying.id) ?? pool.oraclePrice
    const tvlUSD = bigintToUsd(underlying.reserves, underlying.decimals, assetPrice)

    subject.next({
      type: 'liquidity',
      category: 'money-market',
      protocol: PROTOCOL_NAME,
      networkId: CHAIN_ID,
      marketId: pool.address,
      tvlUSD,
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
    let tvlUSD = 0
    for (const asset of pool.tokens) {
      const assetPrice = prices.get(asset.id) ?? 0
      const reserves = asset.reserves.toString()
      const assetReservesUSD = bigintToUsd(asset.reserves, asset.decimals, assetPrice)
      tvlUSD += assetReservesUSD
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
      tvlUSD,
      assets: liquidityAssets,
    })
  }

  async function onBlock(block: Block) {
    if (!initialised || inFlight > 0) {
      return
    }

    inFlight++

    try {
      await updateReserves(block)
      updatePrices()

      if (pools.omnipool) {
        emitLiquidityEvent(pools.omnipool)
      }
      pools.stableswap.forEach((pool) => {
        const tokensWithoutShares = pool.tokens.filter((t) => t.id !== pool.id)
        emitLiquidityEvent({
          ...pool,
          tokens: tokensWithoutShares,
        })
      })
      pools.xyk.forEach(emitLiquidityEvent)
      pools.aave.forEach(emitMMLiquidityEvent)
    } finally {
      inFlight--
    }
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(substrateIngress)
    const blocks$ = shared$.blocks(CHAIN_ID)
    const latestBlock = await firstValueFrom(blocks$)
    await initialise(latestBlock)

    subs.push(blocks$.subscribe(onBlock))
  }

  function getAllPools(): Pool[] {
    const { aave, omnipool, stableswap, xyk } = pools
    return [omnipool, ...aave, ...stableswap, ...xyk].filter((p) => p !== null)
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

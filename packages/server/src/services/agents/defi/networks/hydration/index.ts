import { firstValueFrom, Subject, Subscription } from 'rxjs'
import { DataSteward } from '@/services/agents/steward/agent.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '@/services/agents/steward/types.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID } from './consts.js'
import { createAaveWatcher } from './pools/aave.js'
import { createOmnipoolWatcher } from './pools/omnipool.js'
import { createStableswapWatcher } from './pools/stableswap.js'
import { createXykWatcher } from './pools/xyk.js'
import { calculateSpot } from './pricing/index.js'
import { buildGraph, chartPath } from './routing.js'
import { Path, Pool, PoolsContext } from './types.js'

const DEFAULT_QUOTE_TOKEN = 10

export function hydrationDexMonitor(ingress: IngressConsumers, steward: DataSteward) {
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

  let sub: Subscription
  let inFlight = 0
  let counter = 0

  async function updateReserves(block: Block) {
    pools.xyk = await xyk.updatePoolReserves(pools.xyk)
    pools.omnipool = await omnipool.updatePoolReserves(pools.omnipool)
    pools.stableswap = await stableswaps.updatePoolReserves(pools.stableswap, block)
    pools.aave = await aave.updatePoolReserves(pools.aave)
  }

  function updatePrices() {
    if (counter < 10) {
      console.log('counter', counter)
      return
    }
    console.log('starting price calc')
    try {
      for (const [asset, path] of cachedPaths) {
        if (!path) {
          console.log('No path found', asset)
          continue
        }
        try {
          const spot = calculateSpot(pools, path)
          if (spot) {
            prices.set(asset, spot)
          } else {
            console.log('No spot price calculated', asset)
          }
        } catch (e) {
          console.error(e)
        }
      }
    } finally {
      counter = 0
      console.log('updated prices --', prices)
    }
  }

  async function onBlock(block: Block) {
    counter++
    if (inFlight > 0) {
      return
    }

    inFlight++
    console.log('inFlight:', inFlight)

    try {
      await updateReserves(block)
      updatePrices()
    } finally {
      inFlight--
    }
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(substrateIngress)
    const blocks$ = shared$.blocks(CHAIN_ID)
    const latestBlock = await firstValueFrom(blocks$)
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
        cachedPaths.set(token, chartPath(graph, token, DEFAULT_QUOTE_TOKEN))
      }
    }

    sub = blocks$.subscribe(onBlock)
  }

  function getAllPools(): Pool[] {
    const { aave, omnipool, stableswap, xyk } = pools
    return [omnipool, ...aave, ...stableswap, ...xyk].filter((p) => p !== null)
  }

  return {
    start,
    stop: () => {
      if (sub) {
        sub.unsubscribe()
      }
    },
    chainId: CHAIN_ID,
    events$: subject.asObservable(),
  }
}

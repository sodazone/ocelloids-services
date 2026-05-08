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
import { AavePool, OmniPool, StableSwapPool, XykPool } from './types.js'

type PoolsContext = {
  stableswap: StableSwapPool[]
  omnipool: OmniPool | null
  aave: AavePool[]
  xyk: XykPool[]
}

type Graph<T> = Map<T, T[]>

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

  const _graph: Graph<{
    pool: string
    asset: number
  }> = new Map()

  let sub: Subscription

  async function onBlock(block: Block) {
    if (block.number % 50 !== 0) {
      return
    }
    pools.xyk = await xyk.updatePoolReserves(pools.xyk)
    pools.omnipool = await omnipool.updatePoolReserves(pools.omnipool)
    pools.stableswap = await stableswaps.updatePoolReserves(pools.stableswap, block)
    pools.aave = await aave.updatePoolReserves(pools.aave)
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(substrateIngress)
    const blocks$ = shared$.blocks(CHAIN_ID)
    const latestBlock = await firstValueFrom(blocks$)
    pools.stableswap = await stableswaps.loadPools(latestBlock)
    pools.omnipool = await omnipool.loadPools()
    pools.xyk = await xyk.loadPools()
    pools.aave = await aave.loadPools()

    sub = blocks$.subscribe(onBlock)
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

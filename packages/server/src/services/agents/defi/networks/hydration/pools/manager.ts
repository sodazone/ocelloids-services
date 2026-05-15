import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Block } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, Pool, PoolByType, PoolRegistry, PoolType } from '../types.js'
import { createAaveWatcher } from './aave.js'
import { createHSMWatcher } from './hsm.js'
import { createOmnipoolWatcher } from './omnipool.js'
import { createStableswapWatcher } from './stableswap.js'
import { createXykWatcher } from './xyk.js'

export interface PoolRegistryManager {
  init(block: Block): Promise<void>
  updateReserves(block: Block): Promise<void>

  getSwappablePools(): Pool[]
  getLiquidityPools(): Pool[]
  getPools<K extends PoolType>(type: K): PoolByType<K>[]
  getPool<K extends PoolType>(type: K, address: string): PoolByType<K> | undefined
}

export function createPoolManager(
  logger: Logger,
  ingress: IngressConsumers,
  fetchAssetMetadata: AssetMetadataFetcher,
): PoolRegistryManager {
  const substrateIngress = ingress.substrate
  const evmIngress = ingress.evm

  const fetchBalances = hydrationBalancesFetcher(CHAIN_ID, substrateIngress)

  const omnipool = createOmnipoolWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const stableswaps = createStableswapWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const aave = createAaveWatcher(substrateIngress, evmIngress, fetchAssetMetadata)
  const xyk = createXykWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const hsm = createHSMWatcher(substrateIngress, evmIngress, fetchBalances, fetchAssetMetadata)

  const pools: PoolRegistry = {
    stableswap: [],
    omnipool: [],
    aave: [],
    xyk: [],
    hsm: [],
  }

  function getSwappablePools(): Pool[] {
    const { aave, omnipool, stableswap, xyk } = pools
    return [...omnipool, ...aave, ...stableswap, ...xyk].filter((p) => p !== null)
  }

  function getLiquidityPools(): Pool[] {
    const { omnipool, stableswap, xyk } = pools
    return [
      ...omnipool,
      ...xyk,
      ...stableswap.map((pool) => {
        const tokensWithoutShares = pool.tokens.filter((t) => t.id !== pool.id)
        return {
          ...pool,
          tokens: tokensWithoutShares,
        }
      }),
    ].filter((p) => p !== null)
  }

  function getPools<K extends PoolType>(type: K): PoolByType<K>[] {
    return pools[type]
  }

  function getPool<K extends PoolType>(type: K, address: string): PoolByType<K> | undefined {
    return pools[type].find((pool) => pool.address === address)
  }

  async function init(latestBlock: Block) {
    const stablePools = await stableswaps.loadPools(latestBlock)
    pools.stableswap = stablePools
    pools.omnipool = await omnipool.loadPools()
    pools.xyk = await xyk.loadPools()
    pools.aave = await aave.loadPools()
    pools.hsm = await hsm.loadPools(stablePools)
  }

  async function updateReserves(block: Block) {
    pools.xyk = await xyk.updatePoolReserves(pools.xyk)
    pools.omnipool = await omnipool.updatePoolReserves(pools.omnipool)
    const stablePools = await stableswaps.updatePoolReserves(pools.stableswap, block)
    pools.stableswap = stablePools
    pools.aave = await aave.updatePoolReserves(pools.aave)
    pools.hsm = await hsm.updatePoolReserves(stablePools)
  }

  return {
    init,
    updateReserves,
    getSwappablePools,
    getPool,
    getPools,
    getLiquidityPools,
  }
}

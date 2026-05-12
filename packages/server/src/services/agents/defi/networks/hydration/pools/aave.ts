import { Abi } from 'viem'
import { assetIdToHex } from '@/services/agents/common/hydration.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import aaveDataProviderAbi from '../abi/aave_data_provider.json' with { type: 'json' }
import { AaveV3HydrationMainnet } from '../config.js'
import { CHAIN_ID, EVM_CHAIN_ID } from '../consts.js'
import { AavePool, AssetMetadataFetcher } from '../types.js'

const LOW_LIQUIDITY_POOLS: HexString[] = []

type AaveTradeExecutorPool = {
  reserve: number
  atoken: number
  liqudity_in: bigint
  liqudity_out: bigint
}

type AaveReservesDataResponse = {
  underlyingAsset: HexString
  aTokenAddress: HexString
  decimals: bigint
  availableLiquidity: bigint
  totalScaledVariableDebt: bigint
  priceInMarketReferenceCurrency: bigint
}[]

export function createAaveWatcher(
  substrateIngress: SubstrateIngressConsumer,
  evmIngress: EvmIngressConsumer,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function loadPools(): Promise<AavePool[]> {
    const pools = await substrateIngress.runtimeCall<AaveTradeExecutorPool[]>(CHAIN_ID, {
      api: 'AaveTradeExecutor',
      method: 'pools',
    })
    if (pools === null) {
      throw new Error('No AAVE pools found')
    }

    const poolTokens = pools.flatMap((p) => [p.reserve, p.atoken])
    const assetMetadata = await fetchAssetMetadata(poolTokens.map((a) => a.toString()))

    const aaveReservesResponse: AaveReservesDataResponse[] = await evmIngress.readContract(EVM_CHAIN_ID, {
      address: AaveV3HydrationMainnet.UI_POOL_DATA_PROVIDER as HexString,
      abi: aaveDataProviderAbi as Abi,
      functionName: 'getReservesData',
      args: [AaveV3HydrationMainnet.POOL_ADDRESSES_PROVIDER],
    })
    const aaveReservesData = aaveReservesResponse[0]

    const aavePools: AavePool[] = []

    for (const { reserve, atoken, liqudity_in, liqudity_out } of pools) {
      const reservesHex = assetIdToHex(reserve)
      const reservesData = aaveReservesData.find((a) => a.underlyingAsset.toLowerCase() === reservesHex)
      if (!reservesData) {
        console.error(`No reserves data found for AAVE pool ${reserve}:${atoken}`)
        continue
      }

      const reserveMetadata = assetMetadata.find((m) => m.id === reserve)
      const atokenMetadata = assetMetadata.find((m) => m.id === atoken)

      aavePools.push({
        type: 'aave',
        address: reservesData.aTokenAddress,
        available: reservesData.availableLiquidity,
        borrowed: reservesData.totalScaledVariableDebt,
        oraclePrice: reservesData.priceInMarketReferenceCurrency,
        tokens: [
          {
            id: reserve,
            reserves: liqudity_in,
            decimals: reserveMetadata?.decimals ?? 0,
            symbol: reserveMetadata?.symbol,
            isUnderlying: true,
          },
          {
            id: atoken,
            reserves: liqudity_out,
            decimals: atokenMetadata?.decimals ?? 0,
            symbol: atokenMetadata?.symbol,
            isUnderlying: false,
          },
        ],
        isLowLiquidity: LOW_LIQUIDITY_POOLS.includes(reservesData.aTokenAddress),
      })
    }

    return aavePools
  }

  async function updatePoolReserves(_pools: AavePool[]): Promise<AavePool[]> {
    return loadPools()
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

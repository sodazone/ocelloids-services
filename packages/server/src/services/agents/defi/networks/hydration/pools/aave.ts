import { Abi } from 'viem'
import { toAssetId } from '@/services/agents/common/assets.js'
import { assetIdToHex } from '@/services/agents/common/hydration.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Block } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import aaveDataProviderAbi from '../abi/aave_data_provider.json' with { type: 'json' }
import { AaveV3HydrationMainnet } from '../config.js'
import { CHAIN_ID, EVM_CHAIN_ID } from '../consts.js'
import { AavePool, Pool } from '../types.js'

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
) {
  async function loadPools(): Promise<Pool[]> {
    const pools = await substrateIngress.runtimeCall<AaveTradeExecutorPool[]>(CHAIN_ID, {
      api: 'AaveTradeExecutor',
      method: 'pools',
    })
    if (pools === null) {
      throw new Error('No AAVE pools found')
    }

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
      const reservesData = aaveReservesData.find((a) => a.underlyingAsset === reservesHex)
      if (!reservesData) {
        console.error(`No reserves data found for AAVE pool ${reserve}:${atoken}`)
        continue
      }
      aavePools.push({
        type: 'aave',
        address: reservesData.aTokenAddress,
        available: reservesData.availableLiquidity,
        borrowed: reservesData.totalScaledVariableDebt,
        oraclePrice: reservesData.priceInMarketReferenceCurrency,
        tokens: [
          {
            id: toAssetId(CHAIN_ID, reserve),
            reserves: liqudity_in,
          },
          {
            id: toAssetId(CHAIN_ID, atoken),
            reserves: liqudity_out,
          },
        ],
      })
    }

    return aavePools
  }

  async function getUpdatedPoolReserves(_block: Block): Promise<Pool[]> {
    return loadPools()
  }

  return {
    getUpdatedPoolReserves,
  }
}

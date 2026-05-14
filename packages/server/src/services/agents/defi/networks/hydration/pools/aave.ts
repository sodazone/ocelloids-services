import { Abi, erc20Abi } from 'viem'
import { assetIdToHex } from '@/services/agents/common/hydration.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import aaveDataProviderAbi from '../abi/aave_data_provider.json' with { type: 'json' }
import { AaveV3HydrationMainnet } from '../config.js'
import { CHAIN_ID, EVM_CHAIN_ID } from '../consts.js'
import { PRECISION_BIGINT, TARGET_PRECISION } from '../pricing/common.js'
import { AavePool, AssetMetadataFetcher } from '../types.js'
import { bigintToNumber } from '../utils.js'

const LOW_LIQUIDITY_POOLS: HexString[] = []
const RAY_DECIMALS = 27
const RAY = 10n ** BigInt(RAY_DECIMALS)

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
  totalPrincipalStableDebt: bigint
  totalScaledVariableDebt: bigint
  priceInMarketReferenceCurrency: bigint
  variableBorrowRate: bigint
  liquidityRate: bigint
  variableBorrowIndex: bigint
  borrowCap: bigint
  supplyCap: bigint
  accruedToTreasury: bigint
  unbacked: bigint
  isPaused: boolean
  borrowingEnabled: boolean
}[]

type AaveBaseCurrencyData = {
  marketReferenceCurrencyUnit: bigint
  marketReferenceCurrencyPriceInUsd: bigint
  networkBaseTokenPriceInUsd: bigint
  networkBaseTokenPriceDecimals: number
}

export function createAaveWatcher(
  substrateIngress: SubstrateIngressConsumer,
  evmIngress: EvmIngressConsumer,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function loadPools(): Promise<AavePool[]> {
    const [pools, aaveReservesResponse] = await Promise.all([
      substrateIngress.runtimeCall<AaveTradeExecutorPool[]>(CHAIN_ID, {
        api: 'AaveTradeExecutor',
        method: 'pools',
      }),
      evmIngress.readContract<[AaveReservesDataResponse, AaveBaseCurrencyData]>(EVM_CHAIN_ID, {
        address: AaveV3HydrationMainnet.UI_POOL_DATA_PROVIDER as HexString,
        abi: aaveDataProviderAbi as Abi,
        functionName: 'getReservesData',
        args: [AaveV3HydrationMainnet.POOL_ADDRESSES_PROVIDER],
      }),
    ])
    if (pools === null) {
      throw new Error('No AAVE pools found')
    }

    const poolTokens = pools.flatMap((p) => [p.reserve, p.atoken])
    const assetMetadata = await fetchAssetMetadata(poolTokens.map((a) => a.toString()))

    const aaveReservesData = aaveReservesResponse[0]
    const { marketReferenceCurrencyUnit } = aaveReservesResponse[1]

    const aavePools: AavePool[] = []

    for (const { reserve, atoken } of pools) {
      const reservesHex = assetIdToHex(reserve)
      const reservesData = aaveReservesData.find((a) => a.underlyingAsset.toLowerCase() === reservesHex)
      if (!reservesData) {
        console.error(`No reserves data found for AAVE pool ${reserve}:${atoken}`)
        continue
      }
      const {
        aTokenAddress,
        availableLiquidity,
        borrowCap,
        borrowingEnabled,
        isPaused,
        liquidityRate,
        priceInMarketReferenceCurrency,
        supplyCap,
        totalPrincipalStableDebt,
        totalScaledVariableDebt,
        unbacked,
        variableBorrowIndex,
        variableBorrowRate,
      } = reservesData
      const aTokenSupply = await evmIngress.readContract<bigint>(EVM_CHAIN_ID, {
        address: aTokenAddress,
        abi: erc20Abi,
        functionName: 'totalSupply',
      })

      const reserveMetadata = assetMetadata.find((m) => m.id === reserve)
      const atokenMetadata = assetMetadata.find((m) => m.id === atoken)

      const borrowed = (totalScaledVariableDebt * variableBorrowIndex) / RAY + totalPrincipalStableDebt
      const reserves = availableLiquidity + borrowed
      const utilization = bigintToNumber((borrowed * PRECISION_BIGINT) / reserves, TARGET_PRECISION)
      const supplied = reserves - unbacked
      const solvencyRatio = bigintToNumber((supplied * PRECISION_BIGINT) / aTokenSupply, TARGET_PRECISION)

      aavePools.push({
        type: 'aave',
        address: aTokenAddress,
        oraclePrice: Number(priceInMarketReferenceCurrency) / Number(marketReferenceCurrencyUnit),
        details: {
          utilization,
          borrowAPR: bigintToNumber(variableBorrowRate, RAY_DECIMALS),
          supplyAPR: bigintToNumber(liquidityRate, RAY_DECIMALS),
          borrowCap: borrowCap.toString(),
          supplyCap: supplyCap.toString(),
          canBorrow: borrowingEnabled,
          isPaused: isPaused,
          health: {
            solvencyRatio,
          },
        },
        tokens: [
          {
            id: reserve,
            reserves,
            available: availableLiquidity,
            borrowed,
            decimals: reserveMetadata?.decimals ?? 0,
            symbol: reserveMetadata?.symbol,
            isUnderlying: true,
          },
          {
            id: atoken,
            reserves: aTokenSupply,
            decimals: atokenMetadata?.decimals ?? 0,
            symbol: atokenMetadata?.symbol,
            isUnderlying: false,
          },
        ],
        isLowLiquidity: LOW_LIQUIDITY_POOLS.includes(aTokenAddress),
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

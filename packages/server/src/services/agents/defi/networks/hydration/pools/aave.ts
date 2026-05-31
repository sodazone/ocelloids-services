import { Abi, erc20Abi } from 'viem'
import { hexToAssetId } from '@/services/agents/common/hydration.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { MoneyMarketPayload } from '../../../types.js'
import aaveDataProviderAbi from '../abi/aave_data_provider.json' with { type: 'json' }
import { AaveV3HydrationMainnet, ASSET_ID_MAP, CHAIN_ID, EVM_CHAIN_ID } from '../consts.js'
import { PRECISION_BIGINT, TARGET_PRECISION } from '../pricing/common.js'
import { AavePool, AaveToken, AssetMetadataFetcher } from '../types.js'
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
  symbol: string
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

    const atokens = pools.map((p) => p.atoken)
    const atokensMetadata = await fetchAssetMetadata(atokens.map((a) => a.toString()))

    const aaveReservesData = aaveReservesResponse[0]
    const { marketReferenceCurrencyUnit } = aaveReservesResponse[1]

    const aavePools: AavePool[] = []

    for (const {
      underlyingAsset,
      symbol,
      decimals,
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
    } of aaveReservesData) {
      const underlyingAssetId = ASSET_ID_MAP.get(underlyingAsset) ?? hexToAssetId(underlyingAsset)

      if (!underlyingAssetId) {
        console.error(`No underlyingAssetId found for AAVE pool ${underlyingAsset}:${aTokenAddress}`)
        continue
      }

      const tokens: AaveToken[] = []

      const borrowed = (totalScaledVariableDebt * variableBorrowIndex) / RAY + totalPrincipalStableDebt
      const reserves = availableLiquidity + borrowed
      const utilization =
        reserves > 0n ? bigintToNumber((borrowed * PRECISION_BIGINT) / reserves, TARGET_PRECISION) : undefined
      const supplied = reserves - unbacked

      tokens.push({
        id: underlyingAssetId,
        reserves,
        available: availableLiquidity,
        borrowed,
        decimals: Number(decimals),
        symbol,
        isUnderlying: true,
      })

      const lendingDetails: MoneyMarketPayload = {
        borrowAPR: bigintToNumber(variableBorrowRate, RAY_DECIMALS),
        supplyAPR: bigintToNumber(liquidityRate, RAY_DECIMALS),
        borrowCap: borrowCap.toString(),
        supplyCap: supplyCap.toString(),
        canBorrow: borrowingEnabled,
        isPaused: isPaused,
      }

      const pair = pools.find((a) => a.reserve === underlyingAssetId)
      if (pair !== undefined) {
        const aTokenSupply = await evmIngress.readContract<bigint>(EVM_CHAIN_ID, {
          address: aTokenAddress,
          abi: erc20Abi,
          functionName: 'totalSupply',
        })
        lendingDetails.utilization = utilization
        if (aTokenSupply > 0n) {
          lendingDetails.health = {
            solvencyRatio: bigintToNumber((supplied * PRECISION_BIGINT) / aTokenSupply, TARGET_PRECISION),
          }
        }
        const atokenMetadata = atokensMetadata.find((m) => m.id === pair.atoken)
        tokens.push({
          id: pair.atoken,
          reserves: aTokenSupply,
          decimals: atokenMetadata?.decimals ?? 0,
          symbol: atokenMetadata?.symbol,
          isUnderlying: false,
        })
      }

      aavePools.push({
        type: 'aave',
        address: aTokenAddress,
        oraclePrice:
          marketReferenceCurrencyUnit > 0n
            ? Number(priceInMarketReferenceCurrency) / Number(marketReferenceCurrencyUnit)
            : Number(priceInMarketReferenceCurrency),
        details: lendingDetails,
        tokens,
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

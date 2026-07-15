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
const GIGAHDX_PAIR: AaveTradeExecutorPair = [670, 67]

type AaveTradeExecutorPair = [number, number]

type AaveReservesData = {
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
}

type AaveBaseCurrencyData = {
  marketReferenceCurrencyUnit: bigint
  marketReferenceCurrencyPriceInUsd: bigint
  networkBaseTokenPriceInUsd: bigint
  networkBaseTokenPriceDecimals: number
}

type LoadPoolOptions = {
  type: AavePool['type']
  addressesProvider: HexString
  aavePairs: Map<number, number>
}

export function createAaveWatcher(
  substrateIngress: SubstrateIngressConsumer,
  evmIngress: EvmIngressConsumer,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  function calculateReserveMetrics(reserve: AaveReservesData) {
    const borrowed =
      (reserve.totalScaledVariableDebt * reserve.variableBorrowIndex) / RAY + reserve.totalPrincipalStableDebt

    const reserves = reserve.availableLiquidity + borrowed
    const supplied = reserves - reserve.unbacked

    const utilization =
      reserves > 0n ? bigintToNumber((borrowed * PRECISION_BIGINT) / reserves, TARGET_PRECISION) : undefined

    return {
      borrowed,
      reserves,
      supplied,
      utilization,
    }
  }

  function calculateOraclePrice(price: bigint, referenceUnit: bigint) {
    return referenceUnit > 0n ? Number(price) / Number(referenceUnit) : Number(price)
  }

  async function loadPoolsForConfig({
    type,
    addressesProvider,
    aavePairs,
  }: LoadPoolOptions): Promise<AavePool[]> {
    const [aaveReservesResponse] = await Promise.all([
      evmIngress.readContract<[AaveReservesData[], AaveBaseCurrencyData]>(EVM_CHAIN_ID, {
        address: AaveV3HydrationMainnet.UI_POOL_DATA_PROVIDER as HexString,
        abi: aaveDataProviderAbi as Abi,
        functionName: 'getReservesData',
        args: [addressesProvider],
      }),
    ])

    const reserves = aaveReservesResponse[0]
    const { marketReferenceCurrencyUnit } = aaveReservesResponse[1]

    const reserveInfos = reserves
      .map((reserve) => {
        const underlyingAssetId =
          ASSET_ID_MAP.get(reserve.underlyingAsset) ?? hexToAssetId(reserve.underlyingAsset)

        if (!underlyingAssetId) {
          console.error(
            `No underlyingAssetId found for AAVE pool ${reserve.underlyingAsset}:${reserve.aTokenAddress}`,
          )
          return undefined
        }

        const aTokenId = aavePairs?.get(underlyingAssetId)

        return {
          reserve,
          underlyingAssetId,
          aTokenId,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)

    const metadataIds = [
      ...new Set(
        reserveInfos.map((r) => r.aTokenId?.toString()).filter((id): id is string => id !== undefined),
      ),
    ]

    const metadata = await fetchAssetMetadata(metadataIds)

    const metadataById = new Map(metadata.map((m) => [m.id, m]))

    const supplies = await Promise.all(
      reserveInfos.map((r) =>
        evmIngress.readContract<bigint>(EVM_CHAIN_ID, {
          address: r.reserve.aTokenAddress,
          abi: erc20Abi,
          functionName: 'totalSupply',
        }),
      ),
    )

    return reserveInfos.map(({ reserve, underlyingAssetId, aTokenId }, i) => {
      const { borrowed, reserves, supplied, utilization } = calculateReserveMetrics(reserve)

      const tokens: AaveToken[] = [
        {
          id: underlyingAssetId,
          reserves,
          available: reserve.availableLiquidity,
          borrowed,
          decimals: Number(reserve.decimals),
          symbol: reserve.symbol,
          isUnderlying: true,
        },
      ]

      const details: MoneyMarketPayload = {
        borrowAPR: bigintToNumber(reserve.variableBorrowRate, RAY_DECIMALS),
        supplyAPR: bigintToNumber(reserve.liquidityRate, RAY_DECIMALS),
        borrowCap: reserve.borrowCap.toString(),
        supplyCap: reserve.supplyCap.toString(),
        canBorrow: reserve.borrowingEnabled,
        isPaused: reserve.isPaused,
        utilization,
      }

      if (aTokenId !== undefined) {
        const totalSupply = supplies[i]

        if (totalSupply > 0n) {
          details.health = {
            solvencyRatio: bigintToNumber((supplied * PRECISION_BIGINT) / totalSupply, TARGET_PRECISION),
          }
        }

        const tokenMetadata = metadataById.get(aTokenId)

        tokens.push({
          id: aTokenId,
          reserves: totalSupply,
          decimals: tokenMetadata?.decimals ?? 0,
          symbol: tokenMetadata?.symbol,
          isUnderlying: false,
        })
      }

      return {
        type,
        address: reserve.aTokenAddress,
        oraclePrice: calculateOraclePrice(
          reserve.priceInMarketReferenceCurrency,
          marketReferenceCurrencyUnit,
        ),
        details,
        tokens,
        isLowLiquidity: LOW_LIQUIDITY_POOLS.includes(reserve.aTokenAddress),
      }
    })
  }

  async function loadGigaHdxPools(): Promise<AavePool[]> {
    return loadPoolsForConfig({
      type: 'aave-gigahdx',
      addressesProvider: AaveV3HydrationMainnet.GIGAHDX_POOL_ADDRESSES_PROVIDER as HexString,
      aavePairs: new Map([GIGAHDX_PAIR]),
    })
  }

  async function loadLendingPools(): Promise<AavePool[]> {
    const pairs = await substrateIngress.runtimeCall<AaveTradeExecutorPair[]>(CHAIN_ID, {
      api: 'AaveTradeExecutor',
      method: 'pairs',
    })

    if (!pairs) {
      throw new Error('No AAVE pools found')
    }

    const aavePairs = new Map(pairs)

    return loadPoolsForConfig({
      type: 'aave',
      addressesProvider: AaveV3HydrationMainnet.POOL_ADDRESSES_PROVIDER as HexString,
      aavePairs,
    })
  }

  async function loadPools(): Promise<AavePool[]> {
    const lendingPools = await loadLendingPools()
    const gigaHdxPools = await loadGigaHdxPools()
    return [...lendingPools, ...gigaHdxPools]
  }

  async function updatePoolReserves(_pools: AavePool[]): Promise<AavePool[]> {
    return loadPools()
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

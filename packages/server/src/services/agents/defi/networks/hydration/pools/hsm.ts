import { firstValueFrom, toArray } from 'rxjs'
import { Abi } from 'viem'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import ghoTokenAbi from '../abi/gho_token.json' with { type: 'json' }
import { CHAIN_ID, EVM_CHAIN_ID, HOLLAR_EVM_ADDRESS, HOLLAR_ID, HSM_FACILITATOR_ADDRESS } from '../consts.js'
import {
  AssetMetadataFetcher,
  HsmCollateralToken,
  HsmMintedToken,
  HsmPool,
  StableSwapPool,
} from '../types.js'

type HsmCollateralsValue = {
  pool_id: number
  purchase_fee: number
  max_buy_price_coefficient: bigint
  buyback_rate: number
  buy_back_fee: number
  max_in_holding: bigint
}

export function createHSMWatcher(
  ingress: SubstrateIngressConsumer,
  evmIngress: EvmIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  const facilitatorEvmAddress = HSM_FACILITATOR_ADDRESS.substring(0, 42)

  async function loadPools(stablePools: StableSwapPool[]): Promise<HsmPool[]> {
    const [facilitatorBalances, hollarMetadataResult, collateralsResult] = await Promise.all([
      fetchBalances(HSM_FACILITATOR_ADDRESS),
      fetchAssetMetadata([HOLLAR_ID.toString()]),
      firstValueFrom(
        storageEntriesAtLatest$<[number], HsmCollateralsValue>(ingress, CHAIN_ID, 'HSM', 'Collaterals').pipe(
          toArray(),
        ),
      ),
    ])

    if (collateralsResult.length === 0 || hollarMetadataResult.length === 0) {
      return []
    }
    const hollarMetadata = hollarMetadataResult[0]
    const [capacity, level] = await evmIngress.readContract<[bigint, bigint]>(EVM_CHAIN_ID, {
      abi: ghoTokenAbi as Abi,
      address: HOLLAR_EVM_ADDRESS,
      functionName: 'getFacilitatorBucket',
      args: [facilitatorEvmAddress as `0x${string}`],
    })
    const hollarReserves: HsmMintedToken = {
      id: HOLLAR_ID,
      reserves: level,
      mintCap: capacity,
      decimals: hollarMetadata.decimals ?? 0,
      symbol: hollarMetadata.symbol,
      isCollateral: false,
    }

    const collateralTokens: HsmCollateralToken[] = []

    for (const { key, value } of collateralsResult) {
      const collateralId = key[0]
      const { pool_id, max_buy_price_coefficient, max_in_holding, purchase_fee, buy_back_fee, buyback_rate } =
        value
      const stablePool = stablePools.find((p) => p.id === pool_id)
      const collateralMetadata = stablePool?.tokens.find((t) => t.id === collateralId)
      if (!collateralMetadata) {
        continue
      }
      const collateralBalance = facilitatorBalances.find(({ assetId }) => assetId === collateralId)
      if (!collateralBalance || !collateralBalance.balance) {
        continue
      }
      collateralTokens.push({
        id: collateralId,
        reserves: collateralBalance.balance,
        maxBuyPriceCoefficient: max_buy_price_coefficient,
        maxInHolding: max_in_holding,
        purchaseFee: purchase_fee,
        buyBackFee: buy_back_fee,
        buyBackRate: buyback_rate,
        decimals: collateralMetadata.decimals,
        symbol: collateralMetadata.symbol,
        stablePoolId: pool_id,
        isCollateral: true,
      })
    }
    return [
      {
        type: 'hsm',
        address: HSM_FACILITATOR_ADDRESS,
        id: HOLLAR_ID,
        tokens: [hollarReserves, ...collateralTokens],
        isLowLiquidity: false,
      },
    ]
  }

  async function updatePoolReserves(stablePools: StableSwapPool[]): Promise<HsmPool[]> {
    return loadPools(stablePools)
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

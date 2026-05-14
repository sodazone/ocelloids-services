import { FixedSizeBinary } from 'polkadot-api'
import { firstValueFrom, toArray } from 'rxjs'
import { Abi } from 'viem'
import { toSystemAccountKey } from '@/services/agents/common/accounts.js'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import ghoTokenAbi from '../abi/gho_token.json' with { type: 'json' }
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, HsmPool, StableSwapPool } from '../types.js'

const HOLLAR_ID = 222
const FACILITATOR_ASCII = 'modlpy/hsmod'

type HsmCollateralsValue = {
  pool_id: number
  purchase_fee: number
  max_buy_price_coefficient: bigint
  buyback_rate: number
  buy_back_fee: number
  max_in_holding: bigint
}

function evmAddressFromMultilocation(location?: any): HexString | null {
  if (
    location?.parents === 0 &&
    location.interior &&
    location.interior.type === 'X1' &&
    location.interior.value &&
    location.interior.value.type === 'AccountKey20'
  ) {
    return (location.interior.value.value.key as FixedSizeBinary<20>).asHex()
  }
  return null
}

export function createHSMWatcher(
  ingress: SubstrateIngressConsumer,
  evmIngress: EvmIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function loadPools(stablePools: StableSwapPool[]): Promise<HsmPool[]> {
    const pools: HsmPool[] = []
    const facilitatorAddress = toSystemAccountKey(FACILITATOR_ASCII)
    const facilitatorEvmAddress = facilitatorAddress.substring(0, 42)

    const [facilitatorBalances, hollarMetadataResult, collateralsResult] = await Promise.all([
      fetchBalances(facilitatorAddress),
      fetchAssetMetadata([HOLLAR_ID.toString()]),
      firstValueFrom(
        storageEntriesAtLatest$<HexString, HsmCollateralsValue>(ingress, CHAIN_ID, 'HSM', 'Collaterals').pipe(
          toArray(),
        ),
      ),
    ])

    if (collateralsResult.length === 0 || hollarMetadataResult.length === 0) {
      return pools
    }
    const hollarMetadata = hollarMetadataResult[0]
    const hollarEvmAddress = evmAddressFromMultilocation(hollarMetadata.multiLocation)
    if (!hollarEvmAddress) {
      return pools
    }
    const [capacity, level] = await evmIngress.readContract<[bigint, bigint]>(CHAIN_ID, {
      abi: ghoTokenAbi as Abi,
      address: hollarEvmAddress,
      functionName: 'getFacilitatorBucket',
      args: [facilitatorEvmAddress as `0x${string}`],
    })
    const hsmMintCapacity = capacity - level

    for (const { key, value } of collateralsResult) {
      const collateralId = Buffer.from(key.slice(2), 'hex').readUInt32LE(0)
      const { pool_id, max_buy_price_coefficient, max_in_holding, purchase_fee, buy_back_fee, buyback_rate } =
        value
      const stablePool = stablePools.find((p) => p.id === pool_id)
      if (!stablePool) {
        continue
      }
      const address = toSystemAccountKey('hsm:' + pool_id)
      const collateralBalance = facilitatorBalances.find(({ assetId }) => assetId === collateralId)
      if (!collateralBalance || !collateralBalance.balance) {
        continue
      }
      pools.push({
        ...stablePool,
        address,
        type: 'hsm',
        tokens: stablePool.tokens.filter((t) => t.id !== pool_id),
        hsmAddress: facilitatorAddress,
        hsmMintCapacity: hsmMintCapacity,
        hollarId: HOLLAR_ID,
        hollarH160: hollarEvmAddress,
        collateralId,
        collateralBalance: collateralBalance.balance,
        maxBuyPriceCoefficient: max_buy_price_coefficient,
        maxInHolding: max_in_holding,
        purchaseFee: purchase_fee,
        buyBackFee: buy_back_fee,
        buyBackRate: buyback_rate,
      })
    }
    return pools
  }

  async function updatePoolReserves(stablePools: StableSwapPool[]): Promise<HsmPool[]> {
    return loadPools(stablePools)
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

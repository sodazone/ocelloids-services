import { firstValueFrom, toArray } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { networks } from '@/services/agents/common/networks.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { OmniPool, Pool } from './types.js'

const CHAIN_ID = networks.hydration
const HUB_ASSET_ID = 1
const OMNI_POOL_ADDRESS = '0x6d6f646c6f6d6e69706f6f6c0000000000000000'
const DEFAULT_ASSET_FEE = 2500
const DEFAULT_PROTOCOL_FEE = 500

type OmnipoolValue = {
  hub_reserve: bigint
  shares: bigint
  protocol_shares: bigint
  cap: bigint
  tradable: number
}

export function createOmnipoolWatcher(ingress: SubstrateIngressConsumer) {
  const fetchBalances = hydrationBalancesFetcher(CHAIN_ID, ingress)

  async function getUpdatedPoolReserves(): Promise<Pool[]> {
    const balances = await fetchBalances(OMNI_POOL_ADDRESS)

    const [pairs, feeEntries] = await Promise.all([
      firstValueFrom(
        storageEntriesAtLatest$<number, OmnipoolValue>(ingress, CHAIN_ID, 'Omnipool', 'Assets').pipe(
          toArray(),
        ),
      ),

      firstValueFrom(
        storageEntriesAtLatest$<number, { asset_fee?: number; protocol_fee?: number }>(
          ingress,
          CHAIN_ID,
          'DynamicFees',
          'AssetFee',
        ).pipe(toArray()),
      ),
    ])

    const feeMap = new Map<number, { assetFee: number; protocolFee: number }>()

    for (const { key, value } of feeEntries) {
      feeMap.set(key, {
        assetFee: (value?.asset_fee ?? DEFAULT_ASSET_FEE) / 10_000 / 100,
        protocolFee: (value?.protocol_fee ?? DEFAULT_PROTOCOL_FEE) / 10_000 / 100,
      })
    }

    const pools: OmniPool[] = []

    for (const { key, value } of pairs) {
      try {
        const { hub_reserve } = value

        const balance = balances.find((b) => b.assetId === key)
        if (balance === undefined) {
          continue
        }

        const reserves = balance.balance ?? 0n
        if (reserves === 0n || hub_reserve === 0n) {
          continue
        }

        const fees = feeMap.get(key) ?? {
          assetFee: DEFAULT_ASSET_FEE / 10_000 / 100,
          protocolFee: DEFAULT_PROTOCOL_FEE / 10_000 / 100,
        }

        pools.push({
          type: 'omnipool',
          address: OMNI_POOL_ADDRESS,
          assetFee: fees.assetFee,
          protocolFee: fees.protocolFee,
          tokens: [
            {
              id: toAssetId(CHAIN_ID, key),
              reserves,
            },
            {
              id: toAssetId(CHAIN_ID, HUB_ASSET_ID),
              reserves: hub_reserve,
            },
          ],
        })
      } catch (error) {
        console.error(`Error loading omnipool asset ${key}`, (error as Error).message)
      }
    }

    return pools
  }

  return {
    getUpdatedPoolReserves,
  }
}

import { concatMap, EMPTY, firstValueFrom, from, map, mergeMap, switchMap, take, toArray } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { networks } from '@/services/agents/common/networks.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { OmniPool, Pool } from './types.js'

const CHAIN_ID = networks.hydration
const HUB_ASSET_ID = 1
const OMNI_POOL_ADDRESS = '0x6d6f646c6f6d6e69706f6f6c0000000000000000'

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
    const pairs = await firstValueFrom(
      storageEntriesAtLatest$<number, OmnipoolValue>(ingress, CHAIN_ID, 'Omnipool', 'Assets').pipe(toArray()),
    )
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

        pools.push({
          type: 'omnipool',
          address: OMNI_POOL_ADDRESS,
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

import { firstValueFrom, toArray } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { Block, storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID, OMNI_POOL_ADDRESS } from '../consts.js'
import { OmniPoolToken, Pool } from '../types.js'

type OmnipoolValue = {
  hub_reserve: bigint
  shares: bigint
  protocol_shares: bigint
  cap: bigint
  tradable: number
}

export function createOmnipoolWatcher(
  ingress: SubstrateIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
) {
  async function getUpdatedPoolReserves(_block: Block): Promise<Pool[]> {
    const balances = await fetchBalances(OMNI_POOL_ADDRESS)

    const pairs = await firstValueFrom(
      storageEntriesAtLatest$<HexString, OmnipoolValue>(ingress, CHAIN_ID, 'Omnipool', 'Assets').pipe(
        toArray(),
      ),
    )

    const tokens: OmniPoolToken[] = []

    for (const { key, value } of pairs) {
      try {
        const bytes = Buffer.from(key.slice(2), 'hex')
        const assetId = bytes.readUInt32LE(0)

        const { hub_reserve, cap, protocol_shares, shares } = value

        const balance = balances.find((b) => b.assetId === assetId)
        if (balance === undefined) {
          continue
        }

        const reserves = balance.balance ?? 0n
        if (reserves === 0n || hub_reserve === 0n) {
          continue
        }

        tokens.push({
          id: toAssetId(CHAIN_ID, assetId),
          reserves,
          hubReserves: hub_reserve,
          cap,
          protocolShares: protocol_shares,
          shares,
        })
      } catch (error) {
        console.error(`Error loading omnipool asset ${key}`, (error as Error).message)
      }
    }

    return [
      {
        type: 'omnipool',
        address: OMNI_POOL_ADDRESS,
        tokens,
      },
    ]
  }

  return {
    getUpdatedPoolReserves,
  }
}

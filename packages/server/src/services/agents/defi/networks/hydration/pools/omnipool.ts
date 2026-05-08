import { firstValueFrom, toArray } from 'rxjs'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID, OMNI_POOL_ADDRESS } from '../consts.js'
import { AssetMetadataFetcher, OmniPool, OmniPoolToken } from '../types.js'

type OmnipoolValue = {
  hub_reserve: bigint
  shares: bigint
  protocol_shares: bigint
  cap: bigint
  tradable: number
}

function parseAssetId(key: HexString): number {
  const bytes = Buffer.from(key.slice(2), 'hex')
  return bytes.readUInt32LE(0)
}

export function createOmnipoolWatcher(
  ingress: SubstrateIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function loadPools(): Promise<OmniPool> {
    const balances = await fetchBalances(OMNI_POOL_ADDRESS)

    const omniAssets = await firstValueFrom(
      storageEntriesAtLatest$<HexString, OmnipoolValue>(ingress, CHAIN_ID, 'Omnipool', 'Assets').pipe(
        toArray(),
      ),
    )

    const assetMetadata = await fetchAssetMetadata(omniAssets.map(({ key }) => parseAssetId(key).toString()))

    const tokens: OmniPoolToken[] = []

    for (const { key, value } of omniAssets) {
      try {
        const assetId = parseAssetId(key)

        const { hub_reserve, cap, protocol_shares, shares } = value

        const balance = balances.find((b) => b.assetId === assetId)
        if (balance === undefined) {
          continue
        }

        const reserves = balance.balance ?? 0n
        if (reserves === 0n || hub_reserve === 0n) {
          continue
        }

        const metadata = assetMetadata.find((m) => m.id === assetId)

        tokens.push({
          id: assetId,
          decimals: metadata?.decimals ?? 0,
          symbol: metadata?.symbol,
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

    return {
      type: 'omnipool',
      address: OMNI_POOL_ADDRESS,
      tokens,
    }
  }

  async function updatePoolReserves(pool: OmniPool | null): Promise<OmniPool> {
    const balances = await fetchBalances(OMNI_POOL_ADDRESS)

    const omniAssets = await firstValueFrom(
      storageEntriesAtLatest$<HexString, OmnipoolValue>(ingress, CHAIN_ID, 'Omnipool', 'Assets').pipe(
        toArray(),
      ),
    )
    const tokens: OmniPoolToken[] = []

    for (const { key, value } of omniAssets) {
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

        const token = pool ? pool.tokens.find((m) => m.id === assetId) : undefined
        if (!token) {
          const [metadata] = await fetchAssetMetadata([assetId.toString()])
          tokens.push({
            id: assetId,
            decimals: metadata?.decimals ?? 0,
            symbol: metadata?.symbol,
            reserves,
            hubReserves: hub_reserve,
            cap,
            protocolShares: protocol_shares,
            shares,
          })
        } else {
          tokens.push({
            ...token,
            reserves,
            hubReserves: hub_reserve,
            cap,
            protocolShares: protocol_shares,
            shares,
          })
        }
      } catch (error) {
        console.error(`Error loading omnipool asset ${key}`, (error as Error).message)
      }
    }
    return {
      type: 'omnipool',
      address: OMNI_POOL_ADDRESS,
      tokens,
    }
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

import { firstValueFrom, toArray } from 'rxjs'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, XykPool } from '../types.js'

type XykPoolValue = number[]
const WHITELIST_ASSETS = [5, 10, 15, 22, 25, 30, 34, 36, 252525, 1000081, 1000085]

function isWhitelisted(assetId: number) {
  return WHITELIST_ASSETS.includes(assetId)
}

export function createXykWatcher(
  ingress: SubstrateIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function loadPools(): Promise<XykPool[]> {
    const pairs = await firstValueFrom(
      storageEntriesAtLatest$<HexString, XykPoolValue>(ingress, CHAIN_ID, 'XYK', 'PoolAssets').pipe(
        toArray(),
      ),
    )

    const xykPools: XykPool[] = []

    for (const {
      key,
      value: [assetA, assetB],
    } of pairs) {
      if (!isWhitelisted(assetA) || !isWhitelisted(assetB)) {
        continue
      }
      const balances = await fetchBalances(key)
      const reservesA = balances.find((b) => b.assetId === assetA)
      const reservesB = balances.find((b) => b.assetId === assetB)

      if (!reservesA?.balance || !reservesB?.balance) {
        continue
      }

      const assetMetadata = await fetchAssetMetadata([assetA, assetB].map((a) => a.toString()))
      const metadataA = assetMetadata.find((a) => a.id === assetA)
      const metadataB = assetMetadata.find((a) => a.id === assetB)

      xykPools.push({
        type: 'xyk',
        address: key,
        tokens: [
          {
            id: assetA,
            reserves: reservesA.balance,
            decimals: metadataA?.decimals ?? 0,
            symbol: metadataA?.symbol,
          },
          {
            id: assetB,
            reserves: reservesB.balance,
            decimals: metadataB?.decimals ?? 0,
            symbol: metadataB?.symbol,
          },
        ],
      })
    }

    return xykPools
  }

  async function updatePoolReserves(pools: XykPool[]): Promise<XykPool[]> {
    const xykPools: XykPool[] = []
    for (const pool of pools) {
      const balances = await fetchBalances(pool.address)
      const assetA = pool.tokens[0]
      const assetB = pool.tokens[1]
      const reservesA = balances.find((b) => b.assetId === assetA.id)
      const reservesB = balances.find((b) => b.assetId === assetB.id)

      if (!reservesA?.balance || !reservesB?.balance) {
        continue
      }

      xykPools.push({
        ...pool,
        tokens: [
          {
            ...assetA,
            reserves: reservesA.balance,
          },
          {
            ...assetB,
            reserves: reservesB.balance,
          },
        ],
      })
    }
    return xykPools
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}

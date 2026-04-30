import { firstValueFrom, toArray } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { Block, storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, Pool, XykPool } from '../types.js'

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
  async function loadPools(): Promise<Pool[]> {
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
            id: toAssetId(CHAIN_ID, assetA),
            reserves: reservesA.balance,
            decimals: metadataA?.decimals ?? 0,
            symbol: metadataA?.symbol,
          },
          {
            id: toAssetId(CHAIN_ID, assetB),
            reserves: reservesB.balance,
            decimals: metadataB?.decimals ?? 0,
            symbol: metadataB?.symbol,
          },
        ],
      })
    }

    return xykPools
  }

  async function getUpdatedPoolReserves(_block: Block): Promise<Pool[]> {
    return loadPools()
  }

  return {
    getUpdatedPoolReserves,
  }
}

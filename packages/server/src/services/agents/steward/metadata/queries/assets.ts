import { LRUCache } from 'lru-cache'
import { fromHex } from 'polkadot-api/utils'
import { NetworkURN } from '@/lib.js'
import { LevelDB } from '@/services/types.js'
import { OMEGA_250 } from '../../../consts.js'
import { QueryPagination, QueryResult } from '../../../types.js'
import { AssetMetadata } from '../../types.js'
import { assetMetadataKey, limitCap, paginatedResults } from '../../util.js'

export class AssetsQueryHandler {
  readonly #dbAssets: LevelDB
  readonly #dbAssetsHashIndex: LevelDB
  readonly #cache: LRUCache<string, AssetMetadata, unknown>

  constructor(dbAssets: LevelDB, dbAssetsHashIndex: LevelDB) {
    this.#dbAssets = dbAssets
    this.#dbAssetsHashIndex = dbAssetsHashIndex
    this.#cache = new LRUCache({
      ttl: 3_600_000,
      ttlResolution: 10_000,
      ttlAutopurge: false,
      max: 1_000,
    })
  }

  async queryAssetList(
    criteria?: { network: string },
    pagination?: QueryPagination,
  ): Promise<QueryResult<AssetMetadata>> {
    const cursor = pagination
      ? pagination.cursor === undefined || pagination.cursor === ''
        ? (criteria?.network ?? '')
        : pagination.cursor
      : (criteria?.network ?? '')
    const iterator = this.#dbAssets.iterator<string, AssetMetadata>({
      gt: cursor,
      lt: criteria?.network ? criteria.network + ':' + OMEGA_250 : OMEGA_250,
      limit: limitCap(pagination),
    })
    return await paginatedResults<string, AssetMetadata>(iterator)
  }

  async queryAsset(criteria: { network: string; assets: string[] }[]): Promise<QueryResult<AssetMetadata>> {
    const keys = criteria.flatMap((s) => s.assets.map((a) => assetMetadataKey(s.network as NetworkURN, a)))

    const cachedItems: AssetMetadata[] = []
    const keysToFetch: string[] = []

    for (const key of keys) {
      const cached = this.#cache.get(key)
      if (cached) {
        cachedItems.push(cached)
      } else {
        keysToFetch.push(key)
      }
    }

    const fetchedItems = keysToFetch.length
      ? (
          await this.#dbAssets.getMany<string, AssetMetadata>(keysToFetch, {
            /** */
          })
        ).filter((x) => x !== undefined)
      : []

    fetchedItems.forEach((item, idx) => {
      this.#cache.set(keysToFetch[idx], item)
    })

    return { items: [...cachedItems, ...fetchedItems] }
  }

  async queryAssetByHashIndex({ assetHashes }: { assetHashes: string[] }) {
    const hashBuffers = assetHashes.map((h) => Buffer.from(fromHex(h)))

    const dbKeysFromHashes = await this.#dbAssetsHashIndex.getMany<Buffer, string>(hashBuffers, {
      /** */
    })

    const dbKeyToHash = new Map<string, string>()
    const dbKeys: string[] = []
    dbKeysFromHashes.forEach((dbKey, idx) => {
      if (dbKey) {
        dbKeys.push(dbKey)
        dbKeyToHash.set(dbKey, assetHashes[idx])
      }
    })

    const assets = await this.#dbAssets.getMany<string, AssetMetadata>(dbKeys, {
      /** */
    })

    const items = assets.reduce<(AssetMetadata & { assetKeyHash: string })[]>((acc, asset, idx) => {
      const dbKey = dbKeys[idx]
      const assetHash = dbKeyToHash.get(dbKey)
      if (asset && assetHash) {
        acc.push({
          ...asset,
          assetKeyHash: assetHash,
        })
      }
      return acc
    }, [])

    return { items }
  }
}

import { NetworkURN } from '@/lib.js'
import { LevelDB } from '@/services/types.js'

import { OMEGA_250 } from '../../../consts.js'
import { QueryPagination, QueryResult } from '../../../types.js'
import { AssetMetadata } from '../../types.js'
import { assetMetadataKey, limitCap, paginatedResults } from '../../util.js'

export class AssetsQueryHandler {
  readonly #db: LevelDB

  constructor(db: LevelDB) {
    this.#db = db
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
    const iterator = this.#db.iterator<string, AssetMetadata>({
      gt: cursor,
      lt: criteria?.network ? criteria.network + ':' + OMEGA_250 : OMEGA_250,
      limit: limitCap(pagination),
    })
    return await paginatedResults<string, AssetMetadata>(iterator)
  }

  async queryAsset(
    criteria: {
      network: string
      assets: string[]
    }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const keys = criteria.flatMap((s) => s.assets.map((a) => assetMetadataKey(s.network as NetworkURN, a)))
    const items = (
      await this.#db.getMany<string, AssetMetadata>(keys, {
        /** */
      })
    ).filter((x) => x !== undefined)
    return {
      items,
    }
  }
}

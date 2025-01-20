import { NetworkInfo } from '@/services/ingress/index.js'
import { LevelDB } from '@/services/types.js'

import { QueryPagination, QueryResult } from '../../types.js'
import { limitCap, paginatedResults } from '../util.js'
import { OMEGA_250 } from './consts.js'

export class ChainsQueryHandler {
  readonly #db: LevelDB

  constructor(db: LevelDB) {
    this.#db = db
  }

  async queryChainList(pagination?: QueryPagination): Promise<QueryResult<NetworkInfo>> {
    const iterator = this.#db.iterator<string, NetworkInfo>({
      gt: pagination?.cursor,
      lt: OMEGA_250,
      limit: limitCap(pagination),
    })
    return await paginatedResults<string, NetworkInfo>(iterator)
  }

  async queryChains(criteria: {
    networks: string[]
  }): Promise<QueryResult<NetworkInfo>> {
    const items = (
      await this.#db.getMany<string, NetworkInfo>(criteria.networks, {
        /** */
      })
    ).filter((x) => x !== undefined)
    return {
      items,
    }
  }
}

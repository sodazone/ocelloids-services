import { SubstrateNetworkInfo } from '@/services/networking/substrate/ingress/types.js'
import { LevelDB } from '@/services/types.js'

import { QueryPagination, QueryResult } from '../../types.js'
import { limitCap, paginatedResults } from '../util.js'
import { OMEGA_250 } from './consts.js'

export class ChainsQueryHandler {
  readonly #db: LevelDB

  constructor(db: LevelDB) {
    this.#db = db
  }

  async queryChainList(pagination?: QueryPagination): Promise<QueryResult<SubstrateNetworkInfo>> {
    const iterator = this.#db.iterator<string, SubstrateNetworkInfo>({
      gt: pagination?.cursor,
      lt: OMEGA_250,
      limit: limitCap(pagination),
    })
    return await paginatedResults<string, SubstrateNetworkInfo>(iterator)
  }

  async queryChains(criteria: {
    networks: string[]
  }): Promise<QueryResult<SubstrateNetworkInfo>> {
    const items = (
      await this.#db.getMany<string, SubstrateNetworkInfo>(criteria.networks, {
        /** */
      })
    ).filter((x) => x !== undefined)
    return {
      items,
    }
  }
}

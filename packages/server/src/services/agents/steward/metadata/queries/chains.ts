import { LRUCache } from 'lru-cache'
import { getRelayId } from '@/services/config.js'
import { SubstrateNetworkInfo } from '@/services/networking/substrate/ingress/types.js'
import { LevelDB, NetworkURN } from '@/services/types.js'
import { OMEGA_250 } from '../../../consts.js'
import { QueryPagination, QueryResult } from '../../../types.js'
import { limitCap, paginatedResults } from '../../util.js'

export type SubstrateSS58PrefixInfo = {
  ss58Prefix: number
  chainId: NetworkURN
}

export const DEFAULT_SS58_PREFIX = 42
const SS58_PREFIX_OVERRIDES: Record<string, number> = {
  'urn:ocn:polkadot:2031': 36,
  'urn:ocn:polkadot:2034': 0,
}

export class ChainsQueryHandler {
  readonly #db: LevelDB
  readonly #ss58Cache: LRUCache<string, number, unknown>

  constructor(db: LevelDB) {
    this.#db = db
    this.#ss58Cache = new LRUCache({
      ttl: 86_400_000,
      ttlResolution: 300_000,
      ttlAutopurge: false,
      max: 100,
    })
  }

  async queryChainList(pagination?: QueryPagination): Promise<QueryResult<SubstrateNetworkInfo>> {
    const iterator = this.#db.iterator<string, SubstrateNetworkInfo>({
      gt: pagination?.cursor,
      lt: OMEGA_250,
      limit: limitCap(pagination),
    })
    return await paginatedResults<string, SubstrateNetworkInfo>(iterator)
  }

  async queryChains(criteria: { networks: string[] }): Promise<QueryResult<SubstrateNetworkInfo>> {
    const items = (
      await this.#db.getMany<string, SubstrateNetworkInfo>(criteria.networks, {
        /** */
      })
    ).filter((x) => x !== undefined)
    return {
      items,
    }
  }

  async queryChainsPrefix(criteria: { networks: string[] }): Promise<QueryResult<SubstrateSS58PrefixInfo>> {
    const results: SubstrateSS58PrefixInfo[] = []
    const missing: string[] = []

    for (const network of criteria.networks) {
      if (SS58_PREFIX_OVERRIDES[network] !== undefined) {
        const ss58Prefix = SS58_PREFIX_OVERRIDES[network]
        results.push({ chainId: network as NetworkURN, ss58Prefix })
        continue
      }

      const cached = this.#ss58Cache.get(network)
      if (cached !== undefined) {
        results.push({ chainId: network as NetworkURN, ss58Prefix: cached })
      } else {
        missing.push(network)
      }
    }

    if (missing.length === 0) {
      return { items: results }
    }

    const dbItems = (
      await this.#db.getMany<string, SubstrateNetworkInfo>(missing, {
        /** */
      })
    ).filter((x): x is SubstrateNetworkInfo => x !== undefined)

    for (const { ss58Prefix, urn } of dbItems) {
      let prefix = ss58Prefix
      if (prefix === undefined || prefix === null) {
        prefix = await this.#resolveFallbackPrefix(urn)
      }

      this.#ss58Cache.set(urn, prefix)
      results.push({ chainId: urn as NetworkURN, ss58Prefix: prefix })
    }

    return { items: results }
  }

  async #resolveFallbackPrefix(urn: NetworkURN): Promise<number> {
    const relay = getRelayId(urn)
    const relayPrefix = this.#ss58Cache.get(relay)
    if (relayPrefix !== undefined) {
      return relayPrefix
    }
    const relayInfo = await this.#db.get<string, SubstrateNetworkInfo>(relay, {
      /** */
    })
    return relayInfo?.ss58Prefix ?? DEFAULT_SS58_PREFIX
  }
}

import { NetworkURN, QueryResult } from '@/lib.js'

import { StewardQueries } from '../../types.js'
import { DEFAULT_SS58_PREFIX, SubstrateSS58PrefixInfo } from './chains.js'

export async function fetchSS58Prefix(query: StewardQueries, chainId: NetworkURN): Promise<number> {
  try {
    const { items } = (await query({
      args: {
        op: 'chains.prefix',
        criteria: {
          networks: [chainId],
        },
      },
    })) as QueryResult<SubstrateSS58PrefixInfo>

    const chainInfo = items.length === 0 ? null : items[0]
    return chainInfo?.ss58Prefix ?? DEFAULT_SS58_PREFIX
  } catch (error) {
    console.warn(error, 'Error on fetch prefix', chainId)
    return DEFAULT_SS58_PREFIX
  }
}

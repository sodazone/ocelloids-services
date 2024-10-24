import { AbstractIterator } from 'abstract-level'

import { asJSON } from '@/common/util.js'
import { LevelDB, NetworkURN } from '@/services/types.js'
import { QueryPagination } from '../types.js'

const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

export function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location
  }
  return undefined
}

export function limitCap(pagination?: QueryPagination) {
  return Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX)
}

export async function paginatedResults<K, V>(iterator: AbstractIterator<LevelDB, K, V>) {
  const entries = await iterator.all()

  if (entries.length === 0) {
    return {
      items: [],
    }
  }

  return {
    pageInfo: {
      endCursor: entries[entries.length - 1][0],
      hasNextPage: iterator.count >= iterator.limit,
    },
    items: entries.map(([_, v]) => v),
  }
}

function normalize(assetId: string | object) {
  const str = typeof assetId === 'string' ? assetId : asJSON(assetId)
  return str.toLowerCase().replaceAll('"', '')
}

export function assetMetadataKey(chainId: NetworkURN, assetId: string | object) {
  return `${chainId}:${normalize(assetId)}`
}

import { AbstractIterator } from 'abstract-level'

import { LevelDB, NetworkURN } from '@/services/types.js'
import { QueryPagination } from '../types.js'
import { AssetId } from './types.js'

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

export function toMelbourne(o: unknown): string {
  if (o == null) {
    return ''
  }

  if (typeof o === 'object') {
    return Object.entries(o)
      .flatMap(([k, v]) => {
        if (k === 'type') {
          return v
        }
        if (k === 'value') {
          return v == null ? null : toMelbourne(v)
        }
        return `${k}:${toMelbourne(v)}`
      })
      .filter(Boolean)
      .join(':')
  }

  return o.toString()
}

function normalize(assetId: AssetId) {
  let str
  switch (typeof assetId) {
    case 'string': {
      str = assetId
      break
    }
    case 'number': {
      str = assetId.toString()
      break
    }
    default:
      str = toMelbourne(assetId)
  }
  return str.toLowerCase()
}

export function assetMetadataKey(chainId: NetworkURN, assetId: AssetId) {
  return `${chainId}:${normalize(assetId)}`
}

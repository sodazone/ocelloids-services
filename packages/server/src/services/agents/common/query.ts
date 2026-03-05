import { AbstractIterator } from 'abstract-level'
import { toHex } from 'polkadot-api/utils'
import { LevelDB } from '@/services/types.js'

import { QueryPagination } from '../types.js'

const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

export function limitCap(pagination?: QueryPagination) {
  return Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX)
}

function encodeCursor(key: unknown): string {
  if (typeof key === 'string') {
    return key
  }

  if (Buffer.isBuffer(key) || key instanceof Uint8Array) {
    return toHex(key)
  }

  throw new Error(`Unsupported cursor key type: ${typeof key}`)
}

export async function paginatedResults<K, V>(iterator: AbstractIterator<LevelDB, K, V>) {
  const entries = await iterator.all()

  if (entries.length === 0) {
    return { items: [] }
  }

  const lastKey = entries[entries.length - 1][0]

  return {
    pageInfo: {
      endCursor: encodeCursor(lastKey),
      hasNextPage: iterator.count >= iterator.limit,
    },
    items: entries.map(([_, v]) => v),
  }
}

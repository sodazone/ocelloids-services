import { Codec, Registry } from '@polkadot/types-codec/types'
import { hexToU8a, stringCamelCase } from '@polkadot/util'

import { AbstractIterator } from 'abstract-level'

import { LevelDB, NetworkURN } from '@/services/types.js'
import { QueryPagination } from '../types.js'

const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

export function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location.toJSON === undefined ? location : location.toJSON()
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

export function extractConstant(
  registry: Registry,
  palletName: string,
  constantName: string,
): Codec | undefined {
  for (const { constants, name } of registry.metadata.pallets) {
    if (stringCamelCase(name) === palletName) {
      const constant = constants.find((constant) => stringCamelCase(constant.name) === constantName)
      if (constant) {
        const codec = registry.createTypeUnsafe(registry.createLookupType(constant.type), [
          hexToU8a(constant.value.toHex()),
        ])
        return codec
      }
    }
  }
  return undefined
}

function normalize(assetId: string) {
  return assetId.toLowerCase().replaceAll('"', '')
}

export function assetMetadataKey(chainId: NetworkURN, assetId: string) {
  return `${chainId}:${normalize(assetId)}`
}

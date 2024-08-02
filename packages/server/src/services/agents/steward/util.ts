import { Codec, Registry } from '@polkadot/types-codec/types'
import { hexToU8a, stringCamelCase } from '@polkadot/util'

import { AbstractIterator } from 'abstract-level'

import { LevelDB } from '@/services/types.js'
import { QueryPagination } from '../types.js'

export function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location.toJSON === undefined ? location : location.toJSON()
  }
  return undefined
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

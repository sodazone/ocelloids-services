import { Binary } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'
import { Hashers } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'

export function serializeStorageKeyArg(obj: any): any {
  if (obj == null) {
    return obj
  }

  if (typeof obj === 'string' && obj.startsWith('0x')) {
    return new Binary(fromHex(obj))
  }

  if (typeof obj === 'string') {
    try {
      return BigInt(obj)
    } catch (_error) {
      //
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeStorageKeyArg)
  }

  if (typeof obj === 'object') {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = serializeStorageKeyArg(value)
    }
    return newObj
  }

  return obj
}

export function itemKeyFromStorageKey(
  fullStorageKey: HexString,
  prefix: HexString,
  hashers: Hashers | null,
): HexString {
  const fullHex = fullStorageKey.startsWith('0x') ? fullStorageKey.slice(2) : fullStorageKey

  const prefixHex = prefix.startsWith('0x') ? prefix.slice(2) : prefix

  if (!fullHex.startsWith(prefixHex)) {
    throw new Error('Storage key does not start with given prefix')
  }

  let remaining = fullHex.slice(prefixHex.length)

  if (hashers === null) {
    return `0x${remaining}` as HexString
  }

  for (const hasher of hashers) {
    switch (hasher.tag) {
      case 'Identity':
        return `0x${remaining}` as HexString

      case 'Twox64Concat': {
        const HASH_BYTES = 8
        remaining = remaining.slice(HASH_BYTES * 2)
        return `0x${remaining}` as HexString
      }

      case 'Blake2128Concat': {
        const HASH_BYTES = 16
        remaining = remaining.slice(HASH_BYTES * 2)
        return `0x${remaining}` as HexString
      }

      case 'Twox128':
        remaining = remaining.slice(16 * 2)
        break

      case 'Blake2128':
        remaining = remaining.slice(16 * 2)
        break

      case 'Twox256':
      case 'Blake2256':
        remaining = remaining.slice(32 * 2)
        break

      default:
        throw new Error(`Unsupported hasher: ${(hasher as any).tag}`)
    }
  }

  throw new Error('No raw key present in storage key for given hashers')
}

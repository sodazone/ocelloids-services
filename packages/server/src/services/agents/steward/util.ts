import { Twox128 } from '@polkadot-api/substrate-bindings'
import { HexString } from '@/lib.js'
import { NetworkURN } from '@/services/types.js'
import { toMelbourne } from '../common/melbourne.js'
import { AssetId } from './types.js'

export function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location
  }
  return undefined
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

export function assetMetadataKeyHash(key: string) {
  return Buffer.from(Twox128(Buffer.from(key)))
}

export function bigintToPaddedHex(bn: bigint): HexString {
  const hex = bn.toString(16)
  const padLength = Math.max(0, 40 - hex.length)
  const ffPadding = 'FF'.repeat(Math.ceil(padLength / 2)).slice(0, padLength)
  return `0x${ffPadding}${hex}`
}

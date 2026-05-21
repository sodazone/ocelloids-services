import { NetworkURN } from '@/services/types.js'
import { toMelbourne } from './melbourne.js'

export function toAssetId(chainId: NetworkURN, assetId: string | object | number) {
  return `${chainId}|${toMelbourne(assetId)}`
}

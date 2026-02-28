import { Binary } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'
import { asPublicKey } from '@/common/util.js'

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

export function isXcmLocation(obj: any): obj is { parents: number; interior: any } {
  return obj !== undefined && obj !== null && typeof obj === 'object' && 'parents' in obj && 'interior' in obj
}

export function deriveSovereignAccount(paraId: number, prefix: 'para' | 'sibl'): Uint8Array {
  if (paraId < 0 || paraId > 0xffff) {
    throw new Error('paraId must fit in uint16')
  }

  const prefixBuffer = Buffer.from(prefix, 'ascii')
  if (prefixBuffer.length !== 4) {
    throw new Error('Prefix must be exactly 4 bytes')
  }

  const paraIdBuffer = Buffer.alloc(2)
  paraIdBuffer.writeUInt16LE(paraId, 0)

  const result = Buffer.alloc(32)

  prefixBuffer.copy(result, 0)
  paraIdBuffer.copy(result, 4)

  return new Uint8Array(result)
}

export function decodeSovereignAccount(account: string) {
  const pubKey = fromHex(asPublicKey(account))
  const prefix = Buffer.from(pubKey).subarray(0, 4).toString('ascii')

  const paraIdBytes = pubKey.slice(4, 6)
  const paraId = paraIdBytes[0] | (paraIdBytes[1] << 8)
  return {
    prefix,
    paraId,
  }
}

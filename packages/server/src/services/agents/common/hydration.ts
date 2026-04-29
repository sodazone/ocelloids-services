import { blake2b } from '@noble/hashes/blake2'
import { HexString } from '@/services/subscriptions/types.js'

const textEncoder = new TextEncoder()
const sts = textEncoder.encode('sts')

export function getStablePoolPublicKey(id: number): Uint8Array {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32LE(id)
  const name = Buffer.concat([sts, new Uint8Array(bytes)])
  const poolKey = blake2b(new Uint8Array(name), {
    dkLen: 32,
  })

  return poolKey
}

export function isAssetAddress(address: HexString) {
  const PREFIX_BUFFER = Buffer.from('0000000000000000000000000000000100000000', 'hex')
  const addressBuffer = Buffer.from(address.replace('0x', ''), 'hex')

  if (addressBuffer.length !== 20) {
    return false
  }

  return addressBuffer.subarray(0, 16).equals(new Uint8Array(PREFIX_BUFFER.subarray(0, 16)))
}

export function hexToAssetId(input: HexString) {
  const addressBuffer = Buffer.from(input.replace('0x', ''), 'hex')

  if (addressBuffer.length !== 20 || !isAssetAddress(input)) {
    return null
  }

  return addressBuffer.readUInt32BE(16)
}

export function assetIdToHex(assetId: number): HexString {
  if (!Number.isInteger(assetId) || assetId < 0 || assetId > 0xffffffff) {
    throw new Error('assetId must be a uint32')
  }

  const buffer = Buffer.alloc(20)

  // Prefix: 0000000000000000000000000000000100000000
  buffer.writeUInt32BE(1, 12)

  // Last 4 bytes = asset id
  buffer.writeUInt32BE(assetId, 16)

  return `0x${buffer.toString('hex')}` as HexString
}

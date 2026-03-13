import { blake2b } from '@noble/hashes/blake2'
import bs58 from 'bs58'
import { zeroAddress } from 'viem'
import { HexString } from '@/services/subscriptions/types.js'

const SS58_PREFIX = new TextEncoder().encode('SS58PRE')

export const ethPrefix = Buffer.concat([Buffer.from('ETH', 'ascii'), new Uint8Array([0])])

function encodePrefix(prefix: number): Uint8Array {
  if (prefix < 0 || prefix > 16383) {
    throw new Error('Invalid SS58 prefix')
  }

  if (prefix < 64) {
    return Uint8Array.from([prefix])
  }

  const low = (prefix & 0b00111111) | 0b01000000
  const high = prefix >> 6
  return Uint8Array.from([low, high])
}

export function isZeroAddress(address: string) {
  // allow some freedom in last 2 bytes
  return address.startsWith(zeroAddress.slice(0, 38))
}

export function ss58ToPublicKey(address: string): Uint8Array {
  const decoded = bs58.decode(address.trim())

  if (decoded.length < 35) {
    throw new Error('Invalid SS58 address length')
  }

  const first = decoded[0]

  if (first >= 128) {
    throw new Error('Invalid SS58 prefix')
  }

  const prefixLen = first < 64 ? 1 : 2

  const pubkey = decoded.subarray(prefixLen, prefixLen + 32)

  if (pubkey.length !== 32) {
    throw new Error('Invalid public key length')
  }

  return pubkey
}

export function publicKeyToSS58(publicKey: Uint8Array, prefix = 0): string {
  if (publicKey.length !== 32) {
    throw new Error('Public key must be 32 bytes')
  }

  const prefixBytes = encodePrefix(prefix)

  const payload = new Uint8Array(prefixBytes.length + publicKey.length)
  payload.set(prefixBytes, 0)
  payload.set(publicKey, prefixBytes.length)

  const checksum = blake2b(new Uint8Array([...SS58_PREFIX, ...payload]), { dkLen: 64 }).slice(0, 2)

  const addressBytes = new Uint8Array(payload.length + checksum.length)
  addressBytes.set(payload, 0)
  addressBytes.set(checksum, payload.length)

  return bs58.encode(addressBytes)
}

// EVM address → prefix with "ETH" + 1 zero byte, then address, then pad to 32 bytes
export function padAccountKey20(addr: Buffer | HexString) {
  const addrBuf = typeof addr === 'string' ? Buffer.from(addr.substring(2).toLowerCase(), 'hex') : addr
  const buf = Buffer.alloc(32)
  ethPrefix.copy(buf)
  addrBuf.copy(buf, 4)
  return buf
}

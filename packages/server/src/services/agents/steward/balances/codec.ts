import { toHex } from 'polkadot-api/utils'

import { HexString } from '@/lib.js'

const ethPrefix = Buffer.concat([Buffer.from('ETH', 'ascii'), new Uint8Array([0])])

function uint256ToBuffer(n: bigint) {
  if (n < 0n) {
    throw new Error('uint256 must be >= 0')
  }
  const hex = n.toString(16).padStart(64, '0')
  return Buffer.from(hex, 'hex')
}

function bufferToUint256(buf: Buffer) {
  if (buf.length !== 32) {
    throw new Error('must be 32 bytes')
  }
  return BigInt('0x' + buf.toString('hex'))
}

// EVM address → prefix with "ETH" + 1 zero byte, then address, then pad to 32 bytes
export function padAccountKey20(addr: Buffer | HexString) {
  const addrBuf = typeof addr === 'string' ? Buffer.from(addr.substring(2).toLowerCase(), 'hex') : addr
  const buf = Buffer.alloc(32)
  ethPrefix.copy(buf)
  addrBuf.copy(buf, 4)
  return buf
}

export function normaliseAddress(addressHex: HexString): Buffer {
  const addr = Buffer.from(addressHex.substring(2).toLowerCase(), 'hex')

  if (addr.length === 32) {
    return Buffer.from(addr)
  }

  if (addr.length === 20) {
    return padAccountKey20(addr)
  }

  throw new Error(`Unsupported address length: ${addr.length} bytes`)
}

function fromAddressBuf(addrBuf: Uint8Array): HexString {
  // Check for ETH-prefixed EVM address
  if (addrBuf.length >= 24 && addrBuf.slice(0, 4).every((value, index) => value === ethPrefix[index])) {
    // Strip prefix and take next 20 bytes
    const stripped = addrBuf.slice(4, 24)
    return toHex(stripped) as HexString
  }

  return toHex(addrBuf) as HexString
}

export function createBalancesCodec() {
  function encodeKey(addressHex: HexString, assetIdHex: HexString): Buffer {
    const addrBuf = normaliseAddress(addressHex)
    const assetBuf = Buffer.from(assetIdHex.substring(2), 'hex')
    return Buffer.concat([addrBuf, assetBuf])
  }

  function decodeKey(key: Buffer): { addressHex: HexString; assetIdHex: HexString } {
    if (key.length < 32) {
      throw new Error('key too short to contain address')
    }

    const addrBuf = key.subarray(0, 32)
    const assetBuf = key.subarray(32)

    const addressHex = fromAddressBuf(addrBuf)

    return {
      addressHex,
      assetIdHex: `0x${assetBuf.toString('hex')}`,
    }
  }

  function encodeValue(balance: bigint, epochSeconds: number): Buffer {
    const balanceBuf = uint256ToBuffer(balance)
    const buf = Buffer.alloc(36)
    balanceBuf.copy(buf, 0)
    buf.writeUInt32LE(epochSeconds, 32)
    return buf
  }

  function decodeValue(buf: Buffer): { balance: bigint; epochSeconds: number } {
    if (buf.length < 36) {
      throw new Error('value buffer too small')
    }
    const balance = bufferToUint256(buf.subarray(0, 32))
    const epochSeconds = buf.readUInt32LE(32)
    return { balance, epochSeconds }
  }

  return {
    key: {
      enc: encodeKey,
      dec: decodeKey,
    },
    value: {
      enc: encodeValue,
      dec: decodeValue,
    },
  }
}

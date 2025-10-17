import { decode, encode } from 'cbor-x'
import { fromHex } from 'polkadot-api/utils'
import { HexString } from '@/lib.js'
import { Block } from './types.js'

export function decodeBlock(buffer: Buffer | Uint8Array): Block {
  return decode(buffer)
}

export function encodeBlock(block: Block) {
  return encode(block)
}

export function decodeCompact(data: HexString | ArrayBuffer | Uint8Array<ArrayBufferLike>): {
  value: number
  offset: number
} {
  const dataBuf = typeof data === 'string' ? fromHex(data) : new Uint8Array(data)
  const b0 = dataBuf[0]
  const mode = b0 & 0b11

  if (mode === 0) {
    // single-byte mode
    return { value: b0 >> 2, offset: 1 }
  } else if (mode === 1) {
    // two-byte mode
    if (dataBuf.length < 2) {
      throw new Error('Not enough bytes for 2-byte mode')
    }
    const b1 = dataBuf[1]
    const value = (b0 >> 2) | (b1 << 6)
    return { value, offset: 2 }
  } else if (mode === 2) {
    // four-byte mode
    if (dataBuf.length < 4) {
      throw new Error('Not enough bytes for 4-byte mode')
    }
    const b1 = dataBuf[1]
    const b2 = dataBuf[2]
    const b3 = dataBuf[3]
    const value = (b0 >> 2) | (b1 << 6) | (b2 << 14) | (b3 << 22)
    return { value, offset: 4 }
  } else {
    // big-integer mode
    const lengthBytes = (b0 >> 2) + 4
    if (dataBuf.length < 1 + lengthBytes) {
      throw new Error('Not enough bytes for big-integer mode')
    }
    let value = 0n
    for (let i = 0; i < lengthBytes; i++) {
      value |= BigInt(dataBuf[1 + i]) << (BigInt(i) * 8n)
    }
    return { value: Number(value), offset: 1 + lengthBytes }
  }
}

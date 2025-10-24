import { decode, encode } from 'cbor-x'
import { BlockWithLogs } from './types.js'

export function decodeEvmBlock(buffer: Buffer | Uint8Array): BlockWithLogs {
  return decode(buffer)
}

export function encodeEvmBlock(block: BlockWithLogs) {
  return encode(block)
}

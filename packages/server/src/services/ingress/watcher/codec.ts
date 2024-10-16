import { decode, encode } from 'cbor-x'

import { Block } from '@/services/networking/client.js'

export function decodeBlock(buffer: Buffer | Uint8Array): Block {
  return decode(buffer)
}

export function encodeBlock(block: Block) {
  return encode(block)
}

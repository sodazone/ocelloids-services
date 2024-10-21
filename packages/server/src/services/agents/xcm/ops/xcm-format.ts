import { HexString } from '@/lib.js'
import { ApiContext } from '@/services/networking/client/index.js'

import { Blake2256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'

/**
 * Creates a versioned XCM program from bytes.
 *
 * @param data - The data bytes.
 * @param registry - The registry to decode types.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(data: HexString | Uint8Array, context: ApiContext): Program {
  const xcmTypeId =
    context.getTypeIdByPath('xcm.VersionedXcm') ?? context.getTypeIdByPath('staging.xcm.VersionedXcm')
  if (xcmTypeId === undefined) {
    throw new Error('Versioned XCM type not found in chain registry')
  }
  const codec = context.typeCodec(xcmTypeId)
  const instructions = codec.dec(data)
  const encoded = codec.enc(instructions)
  console.log(instructions)
  return { data: encoded, instructions, hash: toHex(Blake2256(encoded)) as HexString }
}

export type Program = {
  data: Uint8Array
  instructions: Record<string, any>
  hash: HexString
}

function asXcmpVersionedXcms(buffer: Uint8Array, context: ApiContext): Program[] {
  const len = buffer.length
  const xcms: Program[] = []
  let ptr = 1

  while (ptr < len) {
    try {
      const xcm = asVersionedXcm(buffer.slice(ptr), context)
      xcms.push(xcm)
      ptr += xcm.data.length
    } catch (error) {
      // TODO use logger
      console.error(error)
      break
    }
  }

  return xcms
}

/**
 * Decodes XCMP message formats.
 *
 * @param buf The data buffer.
 * @param context The registry to decode types.
 * @returns an array of {@link VersionedXcm} programs.
 */
export function fromXcmpFormat(buf: Uint8Array, context: ApiContext): Program[] {
  switch (buf[0]) {
    case 0x00: {
      // Concatenated XCM fragments
      return asXcmpVersionedXcms(buf, context)
    }
    case 0x01: {
      // XCM blobs
      // XCM blobs not supported, ignore
      break
    }
    case 0x02: {
      // Signals
      // TODO handle signals
      break
    }
    default: {
      throw new Error('Unknown XCMP format')
    }
  }
  return []
}

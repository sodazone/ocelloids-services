import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Blake2256 } from '@polkadot-api/substrate-bindings'
import { fromHex, toHex } from 'polkadot-api/utils'

export type Program = {
  data: Uint8Array
  instructions: Record<string, any>
  hash: HexString
}

export function messageHash(data: HexString | Uint8Array): HexString {
  return toHex(Blake2256(typeof data === 'string' ? fromHex(data) : data)) as HexString
}

export const raw = {
  asVersionedXcm(data: HexString | Uint8Array, context: SubstrateApiContext): Program {
    const codec = versionedXcmCodec(context)
    const instructions = codec.dec(data)
    const encoded = codec.enc(instructions)
    return {
      data: encoded,
      instructions,
      hash: messageHash(encoded),
    }
  },
  asXcmpVersionedXcms(buffer: Uint8Array, context: SubstrateApiContext): Program[] {
    const len = buffer.length
    const xcms: Program[] = []
    let ptr = 1

    while (ptr < len) {
      try {
        const xcm = raw.asVersionedXcm(buffer.slice(ptr), context)
        xcms.push(xcm)
        ptr += xcm.data.length
      } catch (error) {
        // TODO use logger
        console.error(error)
        break
      }
    }

    return xcms
  },
}

/**
 * Creates a versioned XCM program from bytes.
 *
 * @param data - The data bytes.
 * @param context - The API context.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(data: HexString | Uint8Array, context: SubstrateApiContext): Program {
  const xcm = raw.asVersionedXcm(data, context)
  xcm.instructions = asSerializable(xcm.instructions)
  return xcm
}

/**
 * Creates a type codec for Versioned XCMs.
 *
 * @param context - The API context.
 * @returns the codec
 */
export function versionedXcmCodec(context: SubstrateApiContext) {
  const xcmTypeId =
    context.getTypeIdByPath('xcm.VersionedXcm') ??
    context.getTypeIdByPath('staging.xcm.VersionedXcm') ??
    context.getTypeIdByPath('staging_xcm.VersionedXcm')
  if (xcmTypeId === undefined) {
    throw new Error('Versioned XCM type not found in chain registry')
  }
  return context.typeCodec(xcmTypeId)
}

function asXcmpVersionedXcms(buffer: Uint8Array, context: SubstrateApiContext): Program[] {
  return raw.asXcmpVersionedXcms(buffer, context).map((xcm) => {
    xcm.instructions = asSerializable(xcm.instructions)
    return xcm
  })
}

/**
 * Decodes XCMP message formats.
 *
 * @param buf The data buffer.
 * @param context The registry to decode types.
 * @returns an array of {@link VersionedXcm} programs.
 */
export function fromXcmpFormat(buf: Uint8Array, context: SubstrateApiContext): Program[] {
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
      // TODO handle signals (?)
      break
    }
    default: {
      throw new Error('Unknown XCMP format')
    }
  }
  return []
}

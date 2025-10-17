import { Blake2256 } from '@polkadot-api/substrate-bindings'
import { fromHex, toHex } from 'polkadot-api/utils'
import { Struct } from 'scale-ts'

import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { decodeCompact } from '@/services/networking/substrate/codec.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { getMessageId } from './util.js'

export type Program = {
  data: Uint8Array
  instructions: Record<string, any>
  hash: HexString
}

export type OutboundBridgeMessage = {
  destination: Record<string, any>
  xcm: Record<string, any>
  hash: HexString
  messageData: HexString
  id?: HexString
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

export function fromPKBridgeOutboundMessageFormat(
  data: Uint8Array,
  context: SubstrateApiContext,
): OutboundBridgeMessage[] {
  const locTypeId = context.getTypeIdByPath('xcm.versionedinteriorlocation')
  if (!locTypeId) {
    throw new Error('XCM versioned interior location type not found in chain registry')
  }
  const xcmCodec = versionedXcmCodec(context)
  const BridgeMessage = Struct({
    destination: context.typeCodec(locTypeId),
    xcm: xcmCodec,
  })
  const messages: OutboundBridgeMessage[] = []
  let i = 0

  while (i < data.length) {
    const { value: length, offset } = decodeCompact(data.subarray(i))
    const start = i + offset
    const end = start + length
    if (end > data.length) {
      throw new Error('Slice out of range')
    }
    const chunk = data.subarray(start, end)
    const { destination, xcm } = BridgeMessage.dec(toHex(chunk))
    const instructions = asSerializable<Record<string, any>>(xcm)
    const encoded = xcmCodec.enc(xcm)
    messages.push({
      destination,
      xcm: instructions,
      id: getMessageId({ instructions }),
      hash: messageHash(encoded),
      messageData: toHex(encoded) as HexString,
    })
    i = end
  }
  return messages
}

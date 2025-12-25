import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { fromHex } from 'polkadot-api/utils'
import { Enum, Struct, u256 } from 'scale-ts'
import { normalizePublicKey } from '@/common/util.js'
import { defaultPolkadotContext } from '@/services/networking/substrate/.static/index.js'

type Junction =
  | { type: 'Parachain'; value: number }
  | { type: 'GlobalConsensus'; value: any }
  | { type: 'AccountId32'; value: { id: string } }
  | { type: 'AccountKey20'; value: { key: string } }
  | { type: string; value: any }

type Interior =
  | { type: 'Here' }
  | { type: 'X1'; value: Junction[] }
  | { type: 'X2'; value: Junction[] }
  | { type: string; value: Junction[] }

export interface Location {
  parents: number
  interior: Interior
}

export type GmpInstruction = {
  gmp: {
    xcm: {
      destination: Location
      beneficiary: Location
    }
    resolved: {
      urn: string | undefined
      address:
        | {
            key: string
            formatted: string
          }
        | undefined
    }
    rawAction:
      | {
          tag: 'XcmRoutingUserAction'
          value: {
            destination:
              | {
                  tag: 'xcmV5Location'
                  value: any
                }
              | {
                  tag: 'XcmV4Location'
                  value: any
                }
          }
        }
      | {
          tag: 'XcmRoutingUserActionWithFee'
          value: {
            destination:
              | {
                  tag: 'xcmV5Location'
                  value: any
                }
              | {
                  tag: 'XcmV4Location'
                  value: any
                }
            fee: bigint
          }
        }
  }
}

const VersionedLocation = Enum(
  {
    xcmV5Location: defaultPolkadotContext.typeCodec('staging_xcm.v5.location.Location'),
    XcmV4Location: defaultPolkadotContext.typeCodec('staging_xcm.v4.location.Location'),
  },
  [0x05, 0x04],
)

const XcmRoutingUserActionWithFee = Struct({
  destination: VersionedLocation,
  fee: u256,
})
const XcmRoutingUserAction = Struct({
  destination: VersionedLocation,
})

const VersionedUserAction = Enum({
  XcmRoutingUserAction,
  XcmRoutingUserActionWithFee,
})

function interiorToArray(interior: Interior): Junction[] {
  if (interior.type === 'Here') {
    return []
  }
  if ('value' in interior) {
    return [...interior.value]
  }
  return []
}

function arrayToInterior(junctions: Junction[]): Interior {
  switch (junctions.length) {
    case 0:
      return { type: 'Here' }
    case 1:
      return { type: 'X1', value: [junctions[0]] }
    case 2:
      return { type: 'X2', value: [junctions[0], junctions[1]] }
    default:
      return { type: `X${junctions.length}`, value: junctions }
  }
}

function isChainIdJunction(j: Junction): boolean {
  return j.type === 'Parachain' || j.type === 'GlobalConsensus'
}

/**
 * Split an XCM Location into (chainPart, beneficiary).
 * Returns null if it can't be split.
 */
export function splitLocationIntoChainPartAndBeneficiary(location: Location): [Location, Location] | null {
  const allJunctions = interiorToArray(location.interior)
  const beneficiary: Junction[] = []
  const chainPart: Junction[] = [...allJunctions]

  while (chainPart.length > 0) {
    const last = chainPart[chainPart.length - 1]
    if (isChainIdJunction(last)) {
      return [
        { parents: location.parents, interior: arrayToInterior(chainPart) },
        { parents: 0, interior: arrayToInterior(beneficiary) },
      ]
    } else {
      beneficiary.unshift(chainPart.pop()!)
    }
  }

  // if no chain-id junction found but parents === 1 treat parent as chain part
  if (location.parents === 1) {
    return [
      { parents: 1, interior: { type: 'Here' } },
      { parents: 0, interior: arrayToInterior(beneficiary) },
    ]
  }

  return null
}

/**
 * Resolve destination and beneficiary junctions into:
 *  - urn (like urn:ocn:polkadot:2034) | undefined
 *  - address { key, formatted } | undefined
 *
 * Accepts optional ss58Prefix (default 0).
 */
export function resolveDestinationAndBeneficiary({
  destination,
  beneficiary,
  ss58Prefix,
}: {
  destination: Location
  beneficiary?: Location
  ss58Prefix: number
}) {
  let urn: string | undefined

  try {
    if (destination?.parents === 1 && destination.interior?.type === 'X1') {
      const parachainJunction = (destination.interior as any).value?.find(
        (v: Junction) => v.type === 'Parachain',
      )
      if (parachainJunction) {
        urn = `urn:ocn:polkadot:${parachainJunction.value}`
      }
    } else if (destination?.parents === 0) {
      urn = 'urn:ocn:polkadot:0'
    }
  } catch (err) {
    console.warn('resolveDestinationAndBeneficiary: failed to resolve urn', err)
  }

  let address: { key: string; formatted: string } | undefined

  try {
    const value = (beneficiary?.interior as any)?.value ?? []
    const acc = value.find((v: Junction) => v.type === 'AccountId32' || v.type === 'AccountKey20')

    if (acc) {
      if (acc.type === 'AccountId32') {
        const pubkey = normalizePublicKey(acc.value.id.asHex())
        address = { key: pubkey, formatted: fromBufferToBase58(ss58Prefix ?? 0)(fromHex(pubkey)).toString() }
      } else if (acc.type === 'AccountKey20') {
        const raw = acc.value.key.asHex()
        address = { key: raw, formatted: `0x${String(raw).replace(/^0x/, '')}` }
      }
    }
  } catch (err) {
    console.warn('resolveDestinationAndBeneficiary: failed to format beneficiary', err)
  }

  return { urn, address }
}

/**
 * Accepts either Uint8Array or bigint payloads
 * Returns decoded VersionedUserAction or null on failure.
 */
function normalizePayloadToUint8Array(payload: bigint | Uint8Array): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload
  }
  // bigint => hex => buffer
  if (typeof payload === 'bigint') {
    const hex = payload.toString(16)
    // ensure even length
    const even = hex.length % 2 === 0 ? hex : '0' + hex
    return new Uint8Array(Buffer.from(even, 'hex'))
  }
  throw new Error('Unsupported payload type')
}

function decodeGmpPayload(payload: bigint | Uint8Array) {
  const u8 = normalizePayloadToUint8Array(payload)
  const hex = `0x${Buffer.from(u8).toString('hex')}`
  const action = VersionedUserAction.dec(hex)
  return action
}

export function decodeGmpInstruction(payload: bigint | Uint8Array, ss58Prefix = 0): GmpInstruction | null {
  const action = decodeGmpPayload(payload)
  if (!action) {
    return null
  }

  const versionedDestination = (action as any).value?.destination
  if (!versionedDestination) {
    console.warn('decodeGmpInstruction: no destination in decoded action')
    return null
  }

  const maybeLocation: Location | undefined = versionedDestination?.value ?? versionedDestination
  const split = splitLocationIntoChainPartAndBeneficiary(maybeLocation as Location)
  if (!split) {
    return null
  }

  const [destination, beneficiary] = split
  const resolved = resolveDestinationAndBeneficiary({ destination, beneficiary, ss58Prefix })

  return {
    gmp: {
      xcm: {
        destination,
        beneficiary,
      },
      resolved,
      rawAction: action,
    },
  }
}

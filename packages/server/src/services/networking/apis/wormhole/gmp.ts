import { Enum, Struct, u256 } from 'scale-ts'

import { HexString } from '@/lib.js'
import { createContextFromMetadata } from '@/services/networking/substrate/context.js'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// XXX just for now :D
const context = createContextFromMetadata(
  readFileSync(resolve(__dirname, '../../../../testing/__data__/metadata/polkadot.scale')),
)

export const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000000000000000000000000000816'

const VersionedLocation = Enum(
  {
    xcmV5Location: context.typeCodec('staging_xcm.v5.location.Location'),
    XcmV4Location: context.typeCodec('staging_xcm.v4.location.Location'),
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

export function decodeGmpPayload(data: HexString) {
  return VersionedUserAction.dec(data)
}

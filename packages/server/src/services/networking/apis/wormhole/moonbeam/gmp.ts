import { createContextFromMetadata } from '@/services/networking/substrate/context.js'
import { Enum, Struct, u256 } from 'scale-ts'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { asJSON } from '@/common/util.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { splitLocationIntoChainPartAndBeneficiary } from '@/services/networking/apis/wormhole/moonbeam/xcm.js'

// XXX just for now :D
const context = createContextFromMetadata(
  readFileSync(resolve(__dirname, '../../../../../testing/__data__/metadata/polkadot.scale')),
)

export const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000816'

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

function decodeGmpPayload(payload: bigint | Uint8Array) {
  const data = `0x${Buffer.from(payload as Uint8Array).toString('hex')}`
  return VersionedUserAction.dec(data)
}

export function enhancer(payload: bigint | Uint8Array, _assetOp: NewAssetOperation, journey: NewJourney) {
  const action = decodeGmpPayload(payload)
  // Here we know the final destination, but will be by a connecting journey
  const [destination, beneficiary] =
    splitLocationIntoChainPartAndBeneficiary(action.value.destination.value) ?? []

  const gmpInstruction = {
    gmp: {
      userAction: action,
      destination,
      beneficiary,
    },
  }

  let instructions: any[] = []
  if (journey.instructions) {
    try {
      instructions = JSON.parse(journey.instructions)
      if (!Array.isArray(instructions)) {
        instructions = [instructions]
      }
    } catch {
      instructions = []
    }
  }

  if (Object.keys(gmpInstruction.gmp).length > 0) {
    instructions.push(gmpInstruction)
  }

  journey.instructions = asJSON(instructions)
}

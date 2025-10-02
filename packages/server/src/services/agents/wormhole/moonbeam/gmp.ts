import { Enum, Struct, u256 } from 'scale-ts'

import { asJSON } from '@/common/util.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { defaultPolkadotContext } from '@/services/networking/substrate/.static/index.js'

import { splitLocationIntoChainPartAndBeneficiary } from './xcm.js'

export const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000816'

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

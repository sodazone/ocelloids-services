import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Enum, Struct, u256 } from 'scale-ts'

import { WormholescanClient } from '@/services/networking/apis/wormhole/client.js'
import { WormholeChainIds } from '@/services/networking/apis/wormhole/consts.js'
import { isPortalTokenBridge } from '@/services/networking/apis/wormhole/types.js'
import { createContextFromMetadata } from '@/services/networking/substrate/context.js'

const context = createContextFromMetadata(
  readFileSync(resolve(__dirname, '../../testing/__data__/metadata/polkadot.scale')),
)

/*
pub enum VersionedLocation {
	#[codec(index = 1)] // v2 is same as v1 and therefore re-using the v1 index
	V2(deprecated_xcm_v2::MultiLocationV2),
	#[codec(index = 3)]
	V3(xcm::v3::MultiLocation),
	#[codec(index = 4)]
	V4(xcm::v4::Location),
	#[codec(index = 5)]
	V5(xcm::v5::Location),
}*/
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

const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000000000000000000000000000816'
const VersionedUserAction = Enum({
  XcmRoutingUserAction,
  XcmRoutingUserActionWithFee,
})

function decodeGmpPayload(hex: string) {
  return VersionedUserAction.dec('0x' + hex)
}

const client = new WormholescanClient()
const response = await client.fetchOperationById(
  1,
  'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
  1309851,
)

if (isPortalTokenBridge(response)) {
  const payload = response.content.payload
  switch (payload.payloadType) {
    case 1:
      console.log(payload.amount)
      break
    case 2:
      console.log(payload.uri)
      break
    case 3: {
      const { toAddress, toChain, payload: innerBytes } = payload
      if (toChain === WormholeChainIds['urn:ocn:polkadot:1284'] && toAddress === GMP_PRECOMPILE) {
        const action = decodeGmpPayload(innerBytes)
        console.log('EVM TX HASH', response.targetChain.transaction.txHash)
        const destination = action.value.destination.value.interior.value
        console.log('ACTION', destination[0], destination[1].value.id.asHex())
      }
      break
    }
  }
}

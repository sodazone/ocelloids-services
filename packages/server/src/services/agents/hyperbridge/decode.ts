import { fromHex, toHex } from 'polkadot-api/utils'
import { decodeAbiParameters } from 'viem'
import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { AssetTeleport, TokenGatewayActions, Transact } from './types.js'

const BODY_BYTES_SIZE = 161

function toTokenGatewayAction(tag: number): TokenGatewayActions {
  switch (tag) {
    case 0:
      return 'incoming-asset'
    case 1:
      return 'governance-action'
    case 2:
      return 'create-asset'
    case 3:
      return 'deregister-asset'
    case 4:
      return 'change-asset-admin'
    case 5:
      return 'new-contract-instance'
    default:
      throw new Error(`Unknown token gateway action tag: ${tag}`)
  }
}

function decodeTokenGatewayRequestWithCall(data: Uint8Array) {
  const request = decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'assetId', type: 'bytes32' },
          { name: 'redeem', type: 'bool' },
          { name: 'from', type: 'bytes32' },
          { name: 'to', type: 'bytes32' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    data,
  )[0]

  return asSerializable<typeof request>(request)
}

function decodeAssetGatewayRequest(data: Uint8Array) {
  const request = decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'assetId', type: 'bytes32' },
          { name: 'redeem', type: 'bool' },
          { name: 'from', type: 'bytes32' },
          { name: 'to', type: 'bytes32' },
        ],
      },
    ],
    data,
  )[0]

  return asSerializable<typeof request>(request)
}

export function decodeAssetTeleportRequest(req: HexString | Uint8Array): AssetTeleport {
  const buf: Uint8Array = typeof req === 'string' ? fromHex(req) : req
  const action = toTokenGatewayAction(buf[0])
  const body = buf.slice(1)
  try {
    if (buf.length > BODY_BYTES_SIZE) {
      return {
        ...decodeTokenGatewayRequestWithCall(body),
        action,
        type: 'teleport',
      }
    }

    return {
      ...decodeAssetGatewayRequest(body),
      action,
      type: 'teleport',
    }
  } catch (err) {
    throw new Error(`Failed to decode asset teleport request: ${(err as Error).message}`)
  }
}

export function decodeOracleCall(req: HexString | Uint8Array): Transact {
  const data: HexString = typeof req === 'string' ? req : (toHex(req) as HexString)
  try {
    const args = decodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            {
              name: 'token',
              type: 'address',
            },
            {
              name: 'tokenAmount',
              type: 'uint256',
            },
            {
              name: 'vTokenAmount',
              type: 'uint256',
            },
          ],
        },
      ],
      data,
    )[0]
    return {
      type: 'transact',
      method: 'setTokenAmount',
      args: asSerializable<typeof args>(args),
    }
  } catch (err) {
    throw new Error(`Failed to decode oracle call request: ${(err as Error).message}`)
  }
}

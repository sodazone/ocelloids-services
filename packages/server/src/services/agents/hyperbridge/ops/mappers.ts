import { fromHex, toHex } from 'polkadot-api/utils'
import { filter, map, Observable } from 'rxjs'
import { decodeAbiParameters } from 'viem'
import { HexString } from '@/lib.js'
import {
  AssetTeleport,
  HyperbridgeDispatched,
  IsmpPostRequestWithContext,
  TokenGatewayActions,
  Transact,
} from '../types.js'
import { isBifrostOracle, isTokenGateway } from './common.js'

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
  return decodeAbiParameters(
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
}

function decodeAssetGatewayRequest(data: Uint8Array) {
  return decodeAbiParameters(
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
}

function decodeAssetTeleportRequest(req: HexString | Uint8Array): AssetTeleport {
  const buf: Uint8Array = typeof req === 'string' ? fromHex(req) : req
  const action = toTokenGatewayAction(buf[0])
  const body = buf.slice(1)
  try {
    if (buf.length > BODY_BYTES_SIZE) {
      return {
        ...decodeTokenGatewayRequestWithCall(body),
        action,
      }
    }

    return {
      ...decodeAssetGatewayRequest(body),
      action,
    }
  } catch (err) {
    throw new Error(`Failed to decode asset teleport request: ${(err as Error).message}`)
  }
}

function decodeOracleCall(req: HexString | Uint8Array): Transact {
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
      method: 'setTokenAmount',
      args,
    }
  } catch (err) {
    throw new Error(`Failed to decode oracle call request: ${(err as Error).message}`)
  }
}

export function mapIsmpRequestToJourney() {
  return (source: Observable<IsmpPostRequestWithContext>): Observable<HyperbridgeDispatched> => {
    return source.pipe(
      map((req) => {
        if (req.chainId !== req.source) {
          return null
        }
        let decoded: AssetTeleport | Transact | undefined
        try {
          if (isTokenGateway(req.to)) {
            decoded = decodeAssetTeleportRequest(req.body)
          }
          if (isBifrostOracle(req.to)) {
            decoded = decodeOracleCall(req.body)
          }
          // TODO: decode intent gateway requests
          return new HyperbridgeDispatched(req, decoded)
        } catch (err) {
          console.error(err, `Unable to decode request body for ${req.source} (#${req.blockNumber})`)
          return null
        }
      }),
      filter((req) => req !== null),
    )
  }
}

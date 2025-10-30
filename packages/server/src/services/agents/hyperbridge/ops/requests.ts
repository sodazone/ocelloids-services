import { fromHex } from 'polkadot-api/utils'
import { filter, map, Observable, switchMap } from 'rxjs'
import { decodeAbiParameters } from 'viem'
import { HexString } from '@/lib.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchEvent } from '../../xcm/ops/util.js'
import { isTokenGateway } from '../config.js'
import { HyperbridgePostRequest, SubstrateIsmpPostRequest, SubstrateIsmpRequestEvent } from '../types.js'

const BODY_BYTES_SIZE = 161

function toNetworkURN(consensus: string, id: string): NetworkURN {
  const normalisedConsensus = consensus.trim().toLowerCase()
  const normalisedId = id.trim().toLowerCase()
  if (normalisedConsensus === 'evm') {
    return `urn:ocn:ethereum:${normalisedId}`
  }
  return `urn:ocn:${normalisedConsensus}:${normalisedId}`
}

function decodeAssetTeleportRequest(req: HexString | Uint8Array) {
  const buf: Uint8Array = typeof req === 'string' ? fromHex(req) : req
  const tag = buf[0]
  if (buf.length > BODY_BYTES_SIZE) {
    // is body with call
  }
  return decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'asset_id', type: 'bytes32' },
          { name: 'redeem', type: 'bool' },
          { name: 'from', type: 'bytes32' },
          { name: 'to', type: 'bytes32' },
        ],
      },
    ],
    req,
  )
}

export function extractSubstrateRequest(
  getIsmpRequest: (commitment: HexString) => Observable<SubstrateIsmpPostRequest>,
) {
  return (source: Observable<BlockEvent>): Observable<HyperbridgePostRequest> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'Ismp', 'Request')),
      switchMap((blockEvent) => {
        const { source_chain, dest_chain, request_nonce, commitment } =
          blockEvent.value as SubstrateIsmpRequestEvent
        return getIsmpRequest(commitment).pipe(
          map(({ from, to, timeoutTimestamp, body }) => {
            // check type by "to" address and decode accordingly
            if (isTokenGateway(to)) {
              const buf = fromHex(body)
              const decoded = decodeAssetTeleportRequest(buf)
            }
            return {
              source: toNetworkURN(source_chain.type, source_chain.value.toString()),
              destination: toNetworkURN(dest_chain.type, dest_chain.value.toString()),
              commitment,
              nonce: request_nonce.toString(),
              from,
              to,
              timeout: timeoutTimestamp,
              body,
            }
          }),
        )
      }),
    )
  }
}

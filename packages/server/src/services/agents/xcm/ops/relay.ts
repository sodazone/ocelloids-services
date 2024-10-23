import { fromHex } from 'polkadot-api/utils'
import { Observable, filter, map, mergeMap } from 'rxjs'

import { ControlQuery, filterNonNull } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { createNetworkId, getChainId } from '@/services/config.js'
import { ApiContext, BlockExtrinsicWithEvents } from '@/services/networking/index.js'
import { NetworkURN } from '@/services/types.js'

import { GenericXcmRelayedWithContext, XcmRelayedWithContext } from '../types.js'
import { getMessageId, matchExtrinsic } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

export function extractRelayReceive(origin: NetworkURN, messageControl: ControlQuery, context: ApiContext) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<XcmRelayedWithContext> => {
    return source.pipe(
      filter((extrinsic) => matchExtrinsic(extrinsic, 'ParaInherent', 'enter')),
      map((extrinsic) => {
        const backedCandidates = extrinsic.args.data.backed_candidates as {
          candidate: {
            descriptor: {
              para_id: number
            }
            commitments: {
              horizontal_messages: {
                recipient: number
                data: HexString
              }[]
            }
          }
        }[]
        const originId = getChainId(origin)
        const backed = backedCandidates?.find((c) => c.candidate.descriptor.para_id.toString() === originId)
        if (backed) {
          const horizontalMessages = backed.candidate.commitments.horizontal_messages
          const message = horizontalMessages.find(({ recipient }) => {
            return messageControl.value.test({
              recipient: createNetworkId(origin, recipient.toString()),
            })
          })
          if (message) {
            const xcms = fromXcmpFormat(fromHex(message.data), context)
            const { blockHash, blockNumber, blockPosition, dispatchError } = extrinsic
            return xcms.map(
              (xcmProgram) =>
                new GenericXcmRelayedWithContext({
                  blockHash: blockHash as HexString,
                  blockNumber: blockNumber,
                  timestamp: extrinsic.timestamp,
                  recipient: createNetworkId(origin, message.recipient.toString()),
                  messageHash: xcmProgram.hash,
                  messageId: getMessageId(xcmProgram),
                  origin,
                  extrinsicPosition: blockPosition,
                  outcome: dispatchError ? 'Fail' : 'Success',
                  error: dispatchError,
                }),
            )
          }
        }
        return null
      }),
      filterNonNull(),
      mergeMap((x) => x),
    )
  }
}

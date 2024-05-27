import { Observable, filter, map, mergeMap } from 'rxjs'

import type { PolkadotPrimitivesV6InherentData } from '@polkadot/types/lookup'
import type { Registry } from '@polkadot/types/types'

import { ControlQuery, filterNonNull, types } from '@sodazone/ocelloids-sdk'
import { createNetworkId, getChainId } from '../../config.js'
import { NetworkURN } from '../../types.js'
import { GenericXcmRelayedWithContext, XcmRelayedWithContext } from '../types.js'
import { getMessageId, matchExtrinsic } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

export function extractRelayReceive(origin: NetworkURN, messageControl: ControlQuery, registry: Registry) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmRelayedWithContext> => {
    return source.pipe(
      filter(({ extrinsic }) => matchExtrinsic(extrinsic, 'parainherent', 'enter')),
      map(({ extrinsic, dispatchError }) => {
        const { backedCandidates } = extrinsic.args[0] as unknown as PolkadotPrimitivesV6InherentData
        const backed = backedCandidates.find((c) => c.candidate.descriptor.paraId.toString() === getChainId(origin))
        if (backed) {
          const { horizontalMessages } = backed.candidate.commitments
          const message = horizontalMessages.find(({ recipient }) => {
            return messageControl.value.test({
              recipient: createNetworkId(origin, recipient.toString()),
            })
          })
          if (message) {
            const xcms = fromXcmpFormat(message.data, registry)
            const { blockHash, blockNumber, extrinsicId } = extrinsic
            return xcms.map(
              (xcmProgram) =>
                new GenericXcmRelayedWithContext({
                  blockHash: blockHash.toHex(),
                  blockNumber: blockNumber.toPrimitive(),
                  recipient: createNetworkId(origin, message.recipient.toString()),
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  origin,
                  extrinsicId,
                  outcome: dispatchError ? 'Fail' : 'Success',
                  error: dispatchError ? dispatchError.toHuman() : null,
                })
            )
          }
        }
        return null
      }),
      filterNonNull(),
      mergeMap((x) => x)
    )
  }
}

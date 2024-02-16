import { Observable, map, mergeMap, filter } from 'rxjs';

import type {
  PolkadotPrimitivesV5InherentData,
} from '@polkadot/types/lookup';

import {
  ControlQuery,
  filterNonNull,
  types
} from '@sodazone/ocelloids';
import { getMessageId, matchExtrinsic } from './util.js';
import { fromXcmpFormat } from './xcm-format.js';
import { GenericXcmRelayedWithContext, XcmRelayedWithContext } from '../types.js';

export function extractRelayReceive(
  origin: string,
  messageControl: ControlQuery
) {
  return (source: Observable<types.TxWithIdAndEvent>)
  : Observable<XcmRelayedWithContext> => {
    return source.pipe(
      filter(({ extrinsic }) => (
        matchExtrinsic(extrinsic, 'parainherent', 'enter')
      )),
      map(({ extrinsic, dispatchError }) => {
        const { backedCandidates } = extrinsic.args[0] as unknown as PolkadotPrimitivesV5InherentData;
        const backed = backedCandidates.find(c => c.candidate.descriptor.paraId.toString() === origin);
        if (backed) {
          const { horizontalMessages } = backed.candidate.commitments;
          const message = horizontalMessages.find(
            ({ recipient }) => messageControl.value.test({ recipient: recipient.toString() })
          );
          if (message) {
            const xcms = fromXcmpFormat(message.data);
            const { blockHash, blockNumber, extrinsicId } = extrinsic;
            return xcms.map(xcmProgram =>
              new GenericXcmRelayedWithContext({
                blockHash: blockHash.toHex(),
                blockNumber: blockNumber.toPrimitive(),
                recipient: message.recipient.toString(),
                messageHash: xcmProgram.hash.toHex(),
                messageId: getMessageId(xcmProgram),
                origin,
                extrinsicId,
                outcome: dispatchError ? 'Fail' : 'Success',
                error: dispatchError ? dispatchError.toHuman() : null
              })
            );
          }
        }
        return null;
      }),
      filterNonNull(),
      mergeMap(x => x)
    );
  };
}
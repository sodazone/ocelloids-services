import { Observable, map, concatMap, filter } from 'rxjs';

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
        const inherentData = extrinsic.args[0] as unknown as PolkadotPrimitivesV5InherentData;
        const backed = inherentData.backedCandidates.find(c => c.candidate.descriptor.paraId.toString() === origin);
        if (backed) {
          const { horizontalMessages } = backed.candidate.commitments;
          for (const { recipient, data } of horizontalMessages) {
            if (messageControl.value.test({ recipient: recipient.toString() })) {
              const xcms = fromXcmpFormat(data);
              const { blockHash, blockNumber, extrinsicId } = extrinsic;
              return xcms.map(xcmProgram =>
                new GenericXcmRelayedWithContext({
                  blockHash: blockHash.toHex(),
                  blockNumber: blockNumber.toPrimitive(),
                  recipient: recipient.toString(),
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
        }
        return null;
      }),
      filterNonNull(),
      concatMap(x => x),
    );
  };
}
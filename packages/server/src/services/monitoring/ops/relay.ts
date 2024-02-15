import { Observable, map, concatMap, filter } from 'rxjs';

import type {
  PolkadotPrimitivesV5InherentData
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
        const { backedCandidates } = extrinsic.data as unknown as PolkadotPrimitivesV5InherentData;
        const backed = backedCandidates.find(c => c.candidate.descriptor.paraId.toString() === origin);
        if (backed) {
          const { horizontalMessages } = backed.candidate.commitments;
          for (const { recipient, data } of horizontalMessages) {
            if (messageControl.value.test({ recipient })) {
              const xcms = fromXcmpFormat(data);
              const { blockHash, blockNumber } = extrinsic;
              return xcms.map(xcmProgram =>
                new GenericXcmRelayedWithContext({
                  blockHash: blockHash.toHex(),
                  blockNumber: blockNumber.toPrimitive(),
                  recipient: recipient.toString(),
                  instructions: xcmProgram,
                  messageData: data.toU8a(),
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  origin,
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
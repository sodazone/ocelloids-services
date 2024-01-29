import { switchMap, mergeMap, map, from, Observable } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { Vec, Bytes } from '@polkadot/types';
import type { PolkadotCorePrimitivesInboundDownwardMessage } from '@polkadot/types/lookup';
import type { Outcome, VersionedMultiLocation, VersionedMultiAssets, VersionedXcm } from '@polkadot/types/interfaces/xcm';
import { ApiPromise } from '@polkadot/api';

import {
  filterEvents,
  filterExtrinsics,
  filterNonNull,
  mongoFilter, retryWithTruncatedExpBackoff, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageReceivedWithContext,
  GenericXcmMessageSentWithContext,
  XcmCriteria, XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from '../types.js';
import { getMessageId } from './util.js';
import { asVersionedXcm } from './xcm-format.js';

/*
 ==================================================================================
 NOTICE
 ==================================================================================

 This DMP message matching implementation is provisional and will be replaced
 as soon as possible.

 For details see: https://github.com/paritytech/polkadot-sdk/issues/1905
*/

type Json = { [property: string]: Json };

function matchInstructions(
  xcmProgram: VersionedXcm,
  assets: VersionedMultiAssets,
  beneficiary: VersionedMultiLocation
): boolean {
  const program = xcmProgram.value.toHuman() as Json[];
  let sameAssetFun = false;
  let sameBeneficiary = false;

  for (const instruction of program) {
    const {
      DepositAsset, ReceiveTeleportedAsset, ReserveAssetDeposited
    } = instruction;

    if (ReceiveTeleportedAsset || ReserveAssetDeposited) {
      const fun = ReceiveTeleportedAsset?.[0]?.fun ?? ReserveAssetDeposited[0]?.fun;
      if (fun) {
        const asset = assets.value.toHuman() as Json;
        sameAssetFun = (
          JSON.stringify(fun) === JSON.stringify(asset[0]?.fun)
        );
      }
      continue;
    }

    if (DepositAsset) {
      sameBeneficiary = (
        JSON.stringify(
          DepositAsset.beneficiary
        ) === JSON.stringify(
          beneficiary.value.toHuman()
        )
      );
      break;
    }
  }

  return sameAssetFun && sameBeneficiary;
}

function createXcmMessageSent(
  {
    paraId, data, tx: {extrinsic}
  } : {
  paraId: number,
  data: Bytes,
  tx: types.TxWithIdAndEvent
}) : GenericXcmMessageSentWithContext {
  const xcmProgram = asVersionedXcm(data);
  const blockHash = extrinsic.blockHash.toHex();
  const blockNumber = extrinsic.blockNumber.toString();
  return new GenericXcmMessageSentWithContext({
    blockHash,
    blockNumber,
    event: {},
    recipient: paraId,
    instructions: xcmProgram.toHuman(),
    messageData: data,
    messageHash: xcmProgram.hash.toHex(),
    messageId: getMessageId(xcmProgram),
    sender: extrinsic.signer.toHuman()
  });
}

function findDmpMessages(api: ApiPromise) {
  return (source: Observable<types.TxWithIdAndEvent>)
        : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      map(tx => {
        const dest = tx.extrinsic.args[0] as VersionedMultiLocation;
        const beneficiary = tx.extrinsic.args[1] as VersionedMultiLocation;
        const assets = tx.extrinsic.args[2] as VersionedMultiAssets;

        const destJson = dest.value.toHuman() as Json;
        const paraIdStr = destJson?.interior?.X1?.Parachain as unknown as string;

        if (paraIdStr) {
          return {
            tx,
            paraId: parseInt(paraIdStr.replace(/,/g, '')),
            beneficiary,
            assets
          };
        }

        return null;
      }),
      filterNonNull(),
      mergeMap(({ tx, paraId, beneficiary, assets }) => {
        return from(api.at(tx.extrinsic.blockHash)).pipe(
          switchMap(at =>
              from(
                at.query.dmp.downwardMessageQueues(paraId)
              ) as Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>
          ),
          retryWithTruncatedExpBackoff(),
          map(messages => {
            if (messages.length === 1) {
              return createXcmMessageSent({
                tx,
                paraId,
                data: messages[0].msg
              });
            } else {
              // XXX Temporary matching heuristics until DMP message
              // sent event is implemented.
              const filteredMessages = messages.filter(message => {
                const xcmProgram = asVersionedXcm(message.msg);
                return matchInstructions(
                  xcmProgram,
                  assets,
                  beneficiary
                );
              });

              if (filteredMessages.length === 1) {
                return createXcmMessageSent({
                  tx,
                  paraId,
                  data: filteredMessages[0].msg
                });
              }

              if (filteredMessages.length > 1) {
                // XXX See note at the start of this file
                console.error(
                  'Undecidable message set:',
                  filteredMessages.map(m => m.toHuman())
                );
              }

              return null;
            }
          }),
          filterNonNull()
        );
      })
    );
  };
}

export function extractDmpSend(
  api: ApiPromise,
  {
    sendersControl,
    messageControl
  }: XcmCriteria
) {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      filterExtrinsics({
        // 'dispatchError': { $eq: undefined },
        'extrinsic.call.section': 'xcmPallet',
        'extrinsic.call.method': { $in: [
          'limitedReserveTransferAssets',
          'reserveTransferAssets',
          'limitedTeleportAssets',
          'teleportAssets'
        ]}
      }),
      mongoFilter(sendersControl),
      findDmpMessages(api),
      mongoFilter(messageControl)
    );
  };
}

function extractXcmError(outcome: Outcome) {
  if (outcome.isIncomplete) {
    const [_, err] = outcome.asIncomplete;
    return err.type.toString();
  }
  if (outcome.isError) {
    return outcome.asError.type.toString();
  }
  return undefined;
}

function mapDmpQueueMessage() {
  return (source: Observable<types.EventWithIdAndTx>):
      Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      map(event => {
        const xcmMessage = event.data as any;
        const outcome = xcmMessage.outcome as Outcome;
        const messageId = xcmMessage.messageId.toHex();
        const messageHash = xcmMessage.messageHash?.toHex() ?? messageId;

        return new GenericXcmMessageReceivedWithContext({
          event: event.toHuman(),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toString(),
          extrinsicId: event.extrinsicId,
          messageHash,
          messageId,
          outcome: outcome.isComplete ? 'Success' : 'Fail',
          error: outcome.isComplete ? null : extractXcmError(outcome)
        });
      }),
    )
    );
  };
}

export function extractDmpReceive() {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      filterEvents({
        'section': 'dmpQueue',
        'method': 'ExecutedDownward'
      }),
      mapDmpQueueMessage()
    ));
  };
}
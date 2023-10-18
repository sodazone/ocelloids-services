import { switchMap, mergeMap, map, from, Observable } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { Vec } from '@polkadot/types';
import type { AnyJson } from '@polkadot/types-codec/types';
import type { PolkadotCorePrimitivesInboundDownwardMessage } from '@polkadot/types/lookup';
import type { Outcome, VersionedMultiLocation, VersionedMultiAssets, VersionedXcm } from '@polkadot/types/interfaces/xcm';
import { ApiPromise } from '@polkadot/api';

import {
  extractEventsWithTx, extractTxWithEvents, filterNonNull,
  flattenBatch, mongoFilter, retryWithTruncatedExpBackoff, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageReceivedWithContext,
  GenericXcmMessageSentWithContext,
  XcmCriteria, XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from '../types.js';

// TODO: this should be deprecated when...
/**
 *
 * @param api
 * @notice
 */
function findDmpMessages(api: ApiPromise) {
  return (source: Observable<types.TxWithIdAndEvent>)
        : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      map(tx => {
        const dest = tx.extrinsic.args[0] as VersionedMultiLocation;
        const beneficiary = tx.extrinsic.args[1] as VersionedMultiLocation;
        const assets = tx.extrinsic.args[2] as VersionedMultiAssets;

        const destJson = dest.value.toHuman() as Record<string, Record<string, Record<string, AnyJson>>>;
        const paraIdStr = destJson?.interior?.X1?.Parachain as string;

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
      mergeMap(({ tx, paraId, beneficiary }) => {
        return from(api.at(tx.extrinsic.blockHash)).pipe(
          retryWithTruncatedExpBackoff(),
          switchMap(at =>
              from(
                at.query.dmp.downwardMessageQueues(paraId)
              ) as Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>
          ),
          retryWithTruncatedExpBackoff(),
          map(messages => {
            const blockHash = tx.extrinsic.blockHash.toHex();
            const blockNumber = tx.extrinsic.blockNumber.toString();

            if (messages.length === 1) {
              const message =  messages[0];
              const xcmProgram = api.registry.createType(
                'XcmVersionedXcm', message.msg
              ) as VersionedXcm;
              const xcmProgramJson = xcmProgram.value.toHuman() as Record<string, Record<string,AnyJson>>[];
              const matched = xcmProgramJson.find(instruction => {
                const { DepositAsset } = instruction;
                if (DepositAsset) {
                  return JSON.stringify(DepositAsset.beneficiary) === JSON.stringify(beneficiary.value.toHuman());
                }
                return false;
              }) !== undefined;
              console.log('PPPPP', matched, JSON.stringify(xcmProgram.toHuman(), null, 2));
              console.log('AVIPPP', JSON.stringify(beneficiary.value.toHuman(), null, 2));
              return new GenericXcmMessageSentWithContext({
                blockHash,
                blockNumber,
                event: {},
                recipient: paraId,
                instructions: xcmProgram.toHuman(),
                messageData: message.msg,
                messageHash: xcmProgram.hash.toHex()
              });
            } else {
              // Matche by data heuristics...
              // see issue GH
              /*for (const message of messages) {
                  const xcmProgram = api.registry.createType(
                    'XcmVersionedXcm', message.msg
                  );
                }*/
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
    sendersControl
  }: XcmCriteria
) {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      extractTxWithEvents(),
      flattenBatch(),
      mongoFilter({
        'extrinsic.call.section': 'xcmPallet',
        // TODO filter dest in known paras?
        'extrinsic.call.method': { $in: [
          'limitedReserveTransferAssets',
          'reserveTransferAssets',
          'limitedTeleportAssets',
          'teleportAssets'
        ]}
      }),
      mongoFilter(sendersControl),
      findDmpMessages(api)
    );
  };
}

function mapDmpQueueMessage() {
  return (source: Observable<types.EventWithIdAndTx>):
      Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      mongoFilter({
        'section': 'dmpQueue',
        'method': 'ExecutedDownward'
      }),
      map(event => {
        const xcmMessage = event.data as any;
        const outcome = xcmMessage.outcome as Outcome;
        if (outcome.isComplete) {
          return new GenericXcmMessageReceivedWithContext({
            event: event.toHuman(),
            blockHash: event.blockHash.toHex(),
            blockNumber: event.blockNumber.toString(),
            extrinsicId: event.extrinsicId,
            messageHash: xcmMessage.messageId.toHex(),
            outcome: 'Success',
            error: null
          });
        } else {
          return new GenericXcmMessageReceivedWithContext({
            event: event.toHuman(),
            blockHash: event.blockHash.toHex(),
            blockNumber: event.blockNumber.toString(),
            extrinsicId: event.extrinsicId,
            messageHash: xcmMessage.messageId.toHex(),
            outcome: 'Fail',
            // TODO: extract error for Outcome.Incomplete and Outcome.Error
            error: null
          });
        }
      }),
    )
    );
  };
}

export function extractDmpReceive() {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      mapDmpQueueMessage()
    ));
  };
}
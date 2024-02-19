import { bufferCount, switchMap, mergeMap, map, filter, from, Observable } from 'rxjs';

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot';
import type {
  PolkadotCorePrimitivesInboundDownwardMessage,
  XcmVersionedMultiLocation,
  XcmVersionedXcm,
  XcmVersionedMultiAssets
} from '@polkadot/types/lookup';

import type { Vec, Bytes, Compact } from '@polkadot/types';
import type { BlockNumber } from '@polkadot/types/interfaces';
import type { IU8a } from '@polkadot/types-codec/types';
import type { Address } from '@polkadot/types/interfaces/runtime';
import type { Outcome } from '@polkadot/types/interfaces/xcm';
import { ApiPromise } from '@polkadot/api';

import {
  filterNonNull, retryWithTruncatedExpBackoff, types
} from '@sodazone/ocelloids';

import {
  GenericXcmReceivedWithContext,
  GenericXcmSentWithContext,
  XcmCriteria, XcmReceivedWithContext,
  XcmSentWithContext
} from '../types.js';
import {
  getMessageId,
  getParaIdFromMultiLocation,
  getParaIdFromVersionedMultiLocation,
  mapAssetsTrapped,
  matchEvent,
  matchExtrinsic,
  matchProgramByTopic
} from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { matchMessage, matchSenders } from './criteria.js';

/*
 ==================================================================================
 NOTICE
 ==================================================================================

 This DMP message matching implementation is provisional and will be replaced
 as soon as possible.

 For details see: https://github.com/paritytech/polkadot-sdk/issues/1905
*/

type Json = { [property: string]: Json };
type XcmContext = {
  paraId: string,
  data: Bytes,
  blockHash: IU8a,
  blockNumber: Compact<BlockNumber>,
  signer?: Address,
  event?: types.BlockEvent
}

function matchInstructions(
  xcmProgram: XcmVersionedXcm,
  assets: XcmVersionedMultiAssets,
  beneficiary: XcmVersionedMultiLocation
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
    paraId, data, blockHash, blockNumber, signer, event
  } : XcmContext
) : GenericXcmSentWithContext {
  const xcmProgram = asVersionedXcm(data);
  const messageId = getMessageId(xcmProgram);

  return new GenericXcmSentWithContext({
    blockHash: blockHash.toHex(),
    blockNumber: blockNumber.toPrimitive(),
    event: event ? event.toHuman() : {},
    recipient: paraId,
    instructions: xcmProgram,
    messageData: data.toU8a(),
    messageHash: xcmProgram.hash.toHex(),
    messageId,
    sender: signer?.toHuman()
  });
}

function findDmpMessagesFromTx(api: ApiPromise) {
  return (source: Observable<types.TxWithIdAndEvent>)
        : Observable<XcmSentWithContext> => {
    return source.pipe(
      map(tx => {
        const dest = tx.extrinsic.args[0] as XcmVersionedMultiLocation;
        const beneficiary = tx.extrinsic.args[1] as XcmVersionedMultiLocation;
        const assets = tx.extrinsic.args[2] as XcmVersionedMultiAssets;

        const paraId = getParaIdFromVersionedMultiLocation(dest);

        if (paraId) {
          return {
            tx,
            paraId,
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
            const { blockHash, blockNumber, signer } = tx.extrinsic;
            if (messages.length === 1) {
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                signer,
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
                  blockHash,
                  blockNumber,
                  signer,
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

function findDmpMessagesFromEvent(api: ApiPromise) {
  return (source: Observable<types.BlockEvent>)
        : Observable<XcmSentWithContext> => {
    return source.pipe(
      map(event => {
        if (matchEvent(event, 'xcmPallet', 'Sent')) {
          const { destination, messageId } = event.data as any;
          const paraId = getParaIdFromMultiLocation(destination);

          if (paraId) {
            return {
              paraId,
              messageId,
              event
            };
          }
        }

        return null;
      }),
      filterNonNull(),
      mergeMap(({ paraId, messageId, event }) => {
        return from(api.at(event.blockHash)).pipe(
          switchMap(at =>
              from(
                at.query.dmp.downwardMessageQueues(paraId)
              ) as Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>
          ),
          retryWithTruncatedExpBackoff(),
          map(messages => {
            const { blockHash, blockNumber } = event;
            if (messages.length === 1) {
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                paraId,
                event,
                signer: event.extrinsic?.signer,
                data: messages[0].msg
              });
            } else {
              const matching = messages.find(message => {
                const xcmProgram = asVersionedXcm(message.msg);
                return matchProgramByTopic(
                  xcmProgram,
                  messageId
                );
              });

              if (matching) {
                return createXcmMessageSent({
                  blockHash,
                  blockNumber,
                  paraId,
                  event,
                  signer: event.extrinsic?.signer,
                  data: matching.msg
                });
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

const METHODS_DMP = [
  'limitedReserveTransferAssets',
  'reserveTransferAssets',
  'limitedTeleportAssets',
  'teleportAssets'
];

export function extractDmpSend(
  api: ApiPromise,
  {
    sendersControl,
    messageControl
  }: XcmCriteria
) {
  return (source: Observable<types.TxWithIdAndEvent>)
      : Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(tx => {
        const {extrinsic} = tx;
        return tx.dispatchError === undefined
          && matchExtrinsic(extrinsic, 'xcmPallet', METHODS_DMP)
          && matchSenders(sendersControl, extrinsic);
      }),
      findDmpMessagesFromTx(api),
      filter(xcm => matchMessage(messageControl, xcm))
    );
  };
}

export function extractDmpSendByEvent(
  api: ApiPromise,
  {
    sendersControl,
    messageControl
  }: XcmCriteria
) {
  return (source: Observable<types.BlockEvent>)
      : Observable<XcmSentWithContext> => {
    return source.pipe(
      // filtering of events is done in findDmpMessagesFromEvent
      // to take advantage of types augmentation
      filter(event => matchSenders(sendersControl, event.extrinsic)),
      findDmpMessagesFromEvent(api),
      filter(xcm => matchMessage(messageControl, xcm))
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

function createDmpReceivedWithContext(event: types.BlockEvent, assetsTrappedEvent?: types.BlockEvent) {
  const xcmMessage = event.data as any;
  const outcome = xcmMessage.outcome as Outcome;
  const messageId = xcmMessage.messageId.toHex();
  const messageHash = xcmMessage.messageHash?.toHex() ?? messageId;
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent);

  return new GenericXcmReceivedWithContext({
    event: event.toHuman(),
    blockHash: event.blockHash.toHex(),
    blockNumber: event.blockNumber.toPrimitive(),
    extrinsicId: event.extrinsicId,
    messageHash,
    messageId,
    outcome: outcome.isComplete ? 'Success' : 'Fail',
    error: outcome.isComplete ? null : extractXcmError(outcome),
    assetsTrapped
  });
}

export function extractDmpReceive() {
  return (source: Observable<types.BlockEvent>)
      : Observable<XcmReceivedWithContext>  => {
    return (source.pipe(
      bufferCount(2,1),
      map(([maybeAssetTrapEvent, maybeDmpEvent]) => {
        // in reality we expect a continuous stream of events but
        // in tests, maybeDmpEvent could be undefined if there are odd number of events
        if (
          maybeDmpEvent &&
          matchEvent(maybeDmpEvent, 'dmpQueue', 'ExecutedDownward')
        ) {
          const assetTrapEvent =
            matchEvent(maybeAssetTrapEvent, 'polkadotXcm', 'AssetsTrapped') ?
              maybeAssetTrapEvent :
              undefined;
          return createDmpReceivedWithContext(maybeDmpEvent, assetTrapEvent);
        }
        return null;
      }),
      filterNonNull()
    ));
  };
}
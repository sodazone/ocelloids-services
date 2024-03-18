import { bufferCount, mergeMap, map, filter, Observable } from 'rxjs';

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot';
import type { XcmVersionedMultiLocation, XcmVersionedMultiAssets } from '@polkadot/types/lookup';
import type { Registry } from '@polkadot/types/types';
import type { Compact } from '@polkadot/types';
import type { BlockNumber } from '@polkadot/types/interfaces';
import type { IU8a } from '@polkadot/types-codec/types';
import type { Address } from '@polkadot/types/interfaces/runtime';
import type { Outcome } from '@polkadot/types/interfaces/xcm';

import { filterNonNull, types } from '@sodazone/ocelloids-sdk';

import {
  AnyJson,
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmCriteria,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js';
import {
  getMessageId,
  getParaIdFromMultiLocation,
  getParaIdFromVersionedMultiLocation,
  mapAssetsTrapped,
  matchEvent,
  matchExtrinsic,
  matchProgramByTopic,
} from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { matchMessage, matchSenders } from './criteria.js';
import { XcmVersionedXcm } from './xcm-types.js';
import { GetDownwardMessageQueues } from '../types-augmented.js';

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
  paraId: string;
  data: Uint8Array;
  program: XcmVersionedXcm;
  blockHash: IU8a;
  blockNumber: Compact<BlockNumber>;
  signer?: Address;
  event?: types.BlockEvent;
};

function matchInstructions(
  xcmProgram: XcmVersionedXcm,
  assets: XcmVersionedMultiAssets,
  beneficiary: XcmVersionedMultiLocation
): boolean {
  const program = xcmProgram.value.toHuman() as Json[];
  let sameAssetFun = false;
  let sameBeneficiary = false;

  for (const instruction of program) {
    const { DepositAsset, ReceiveTeleportedAsset, ReserveAssetDeposited } = instruction;

    if (ReceiveTeleportedAsset || ReserveAssetDeposited) {
      const fun = ReceiveTeleportedAsset?.[0]?.fun ?? ReserveAssetDeposited[0]?.fun;
      if (fun) {
        const asset = assets.value.toHuman() as Json;
        sameAssetFun = JSON.stringify(fun) === JSON.stringify(asset[0]?.fun);
      }
      continue;
    }

    if (DepositAsset) {
      sameBeneficiary = JSON.stringify(DepositAsset.beneficiary) === JSON.stringify(beneficiary.value.toHuman());
      break;
    }
  }

  return sameAssetFun && sameBeneficiary;
}

function createXcmMessageSent({
  paraId,
  data,
  program,
  blockHash,
  blockNumber,
  signer,
  event,
}: XcmContext): GenericXcmSentWithContext {
  const messageId = getMessageId(program);

  return new GenericXcmSentWithContext({
    blockHash: blockHash.toHex(),
    blockNumber: blockNumber.toPrimitive(),
    event: event ? event.toHuman() : {},
    recipient: paraId,
    instructions: {
      bytes: program.toU8a(),
      json: program.toHuman(),
    },
    messageData: data,
    messageHash: program.hash.toHex(),
    messageId,
    sender: signer?.toHuman(),
  });
}

// Will be obsolete after DMP refactor:
// https://github.com/paritytech/polkadot-sdk/pull/1246
function findDmpMessagesFromTx(getDmp: GetDownwardMessageQueues, registry: Registry) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((tx) => {
        const dest = tx.extrinsic.args[0] as XcmVersionedMultiLocation;
        const beneficiary = tx.extrinsic.args[1] as XcmVersionedMultiLocation;
        const assets = tx.extrinsic.args[2] as XcmVersionedMultiAssets;

        const paraId = getParaIdFromVersionedMultiLocation(dest);

        if (paraId) {
          return {
            tx,
            paraId,
            beneficiary,
            assets,
          };
        }

        return null;
      }),
      filterNonNull(),
      mergeMap(({ tx, paraId, beneficiary, assets }) => {
        return getDmp(tx.extrinsic.blockHash.toHex(), paraId).pipe(
          map((messages) => {
            const { blockHash, blockNumber, signer } = tx.extrinsic;
            if (messages.length === 1) {
              const data = messages[0].msg;
              const program = asVersionedXcm(data, registry);
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                signer,
                paraId,
                data,
                program,
              });
            } else {
              // XXX Temporary matching heuristics until DMP message
              // sent event is implemented.
              // Only matches the first message found.
              for (const message of messages) {
                const data = message.msg;
                const program = asVersionedXcm(data, registry);
                if (matchInstructions(program, assets, beneficiary)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    signer,
                    paraId,
                    data,
                    program,
                  });
                }
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

function findDmpMessagesFromEvent(getDmp: GetDownwardMessageQueues, registry: Registry) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        if (matchEvent(event, 'xcmPallet', 'Sent')) {
          const { destination, messageId } = event.data as any;
          const paraId = getParaIdFromMultiLocation(destination);

          if (paraId) {
            return {
              paraId,
              messageId,
              event,
            };
          }
        }

        return null;
      }),
      filterNonNull(),
      mergeMap(({ paraId, messageId, event }) => {
        return getDmp(event.blockHash.toHex(), paraId).pipe(
          map((messages) => {
            const { blockHash, blockNumber } = event;
            if (messages.length === 1) {
              const data = messages[0].msg;
              const program = asVersionedXcm(data, registry);
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                paraId,
                event,
                signer: event.extrinsic?.signer,
                data,
                program,
              });
            } else {
              // Since we are matching by topic and it is assumed that the TopicId is unique
              // we can break out of the loop on first matching message found.
              for (const message of messages) {
                const data = message.msg;
                const program = asVersionedXcm(data, registry);
                if (matchProgramByTopic(program, messageId)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    paraId,
                    event,
                    signer: event.extrinsic?.signer,
                    data,
                    program,
                  });
                }
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
  'teleportAssets',
];

export function extractDmpSend(
  { sendersControl, messageControl }: XcmCriteria,
  getDmp: GetDownwardMessageQueues,
  registry: Registry
) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((tx) => {
        const { extrinsic } = tx;
        return (
          tx.dispatchError === undefined &&
          matchExtrinsic(extrinsic, 'xcmPallet', METHODS_DMP) &&
          matchSenders(sendersControl, extrinsic)
        );
      }),
      findDmpMessagesFromTx(getDmp, registry),
      filter((xcm) => matchMessage(messageControl, xcm))
    );
  };
}

export function extractDmpSendByEvent(
  { sendersControl, messageControl }: XcmCriteria,
  getDmp: GetDownwardMessageQueues,
  registry: Registry
) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      // filtering of events is done in findDmpMessagesFromEvent
      // to take advantage of types augmentation
      filter((event) => matchSenders(sendersControl, event.extrinsic)),
      findDmpMessagesFromEvent(getDmp, registry),
      filter((xcm) => matchMessage(messageControl, xcm))
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
  let outcome: 'Success' | 'Fail' = 'Fail';
  let error: AnyJson;
  if (xcmMessage.outcome !== undefined) {
    const o = xcmMessage.outcome as Outcome;
    outcome = o.isComplete ? 'Success' : 'Fail';
    error = extractXcmError(o);
  } else if (xcmMessage.success !== undefined) {
    outcome = xcmMessage.success ? 'Success' : 'Fail';
  }

  const messageId = xcmMessage.messageId ? xcmMessage.messageId.toHex() : xcmMessage.id.toHex();
  const messageHash = xcmMessage.messageHash?.toHex() ?? messageId;
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent);

  return new GenericXcmInboundWithContext({
    event: event.toHuman(),
    blockHash: event.blockHash.toHex(),
    blockNumber: event.blockNumber.toPrimitive(),
    extrinsicId: event.extrinsicId,
    messageHash,
    messageId,
    outcome,
    error,
    assetsTrapped,
  });
}

export function extractDmpReceive() {
  return (source: Observable<types.BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeDmpEvent]) => {
        // in reality we expect a continuous stream of events but
        // in tests, maybeDmpEvent could be undefined if there are odd number of events
        if (
          maybeDmpEvent &&
          (matchEvent(maybeDmpEvent, 'dmpQueue', 'ExecutedDownward') ||
            matchEvent(maybeDmpEvent, 'messageQueue', 'Processed'))
        ) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'polkadotXcm', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined;
          return createDmpReceivedWithContext(maybeDmpEvent, assetTrapEvent);
        }
        return null;
      }),
      filterNonNull()
    );
  };
}

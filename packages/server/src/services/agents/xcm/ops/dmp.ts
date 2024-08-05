import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot'
import type { Compact } from '@polkadot/types'
import type { u64 } from '@polkadot/types-codec'
import type { IU8a } from '@polkadot/types-codec/types'
import type { BlockNumber } from '@polkadot/types/interfaces'
import type { Outcome } from '@polkadot/types/interfaces/xcm'
import type { Registry } from '@polkadot/types/types'

import { filterNonNull, types } from '@sodazone/ocelloids-sdk'

import { SignerData } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { GetDownwardMessageQueues } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { blockEventToHuman } from './common.js'
import {
  getMessageId,
  getSendersFromEvent,
  getSendersFromExtrinsic,
  mapAssetsTrapped,
  matchEvent,
  matchExtrinsic,
  matchProgramByTopic,
  networkIdFromMultiLocation,
  networkIdFromVersionedMultiLocation,
} from './util.js'
import { asVersionedXcm } from './xcm-format.js'
import { XcmVersionedAssets, XcmVersionedLocation, XcmVersionedXcm } from './xcm-types.js'

/*
 ==================================================================================
 NOTICE
 ==================================================================================

 This DMP message matching implementation is provisional and will be replaced
 as soon as possible.

 For details see: https://github.com/paritytech/polkadot-sdk/issues/1905
*/

type Json = { [property: string]: Json }
type XcmContext = {
  recipient: NetworkURN
  data: Uint8Array
  program: XcmVersionedXcm
  blockHash: IU8a
  blockNumber: Compact<BlockNumber>
  timestamp?: u64
  sender?: SignerData
  event?: types.BlockEvent
}

// eslint-disable-next-line complexity
function matchInstructions(
  xcmProgram: XcmVersionedXcm,
  assets: XcmVersionedAssets,
  beneficiary: XcmVersionedLocation,
): boolean {
  const program = xcmProgram.value.toHuman() as Json[]
  let sameAssetFun = false
  let sameBeneficiary = false

  for (const instruction of program) {
    const { DepositAsset, ReceiveTeleportedAsset, ReserveAssetDeposited } = instruction

    if (ReceiveTeleportedAsset || ReserveAssetDeposited) {
      const fun = ReceiveTeleportedAsset?.[0]?.fun ?? ReserveAssetDeposited[0]?.fun
      if (fun) {
        const asset = assets.value.toHuman() as Json
        sameAssetFun = JSON.stringify(fun) === JSON.stringify(asset[0]?.fun)
      }
      continue
    }

    if (DepositAsset) {
      sameBeneficiary =
        JSON.stringify(DepositAsset.beneficiary) === JSON.stringify(beneficiary.value.toHuman())
      break
    }
  }

  return sameAssetFun && sameBeneficiary
}

function createXcmMessageSent({
  recipient,
  data,
  program,
  blockHash,
  blockNumber,
  timestamp,
  sender,
  event,
}: XcmContext): GenericXcmSentWithContext {
  const messageId = getMessageId(program)

  return new GenericXcmSentWithContext({
    blockHash: blockHash.toHex(),
    blockNumber: blockNumber.toPrimitive(),
    timestamp: timestamp?.toNumber(),
    event: event ? blockEventToHuman(event) : {},
    recipient,
    instructions: {
      bytes: program.toU8a(),
      json: program.toHuman(),
    },
    messageData: data,
    messageHash: program.hash.toHex(),
    messageId,
    sender,
  })
}

// Will be obsolete after DMP refactor:
// https://github.com/paritytech/polkadot-sdk/pull/1246
function findDmpMessagesFromTx(getDmp: GetDownwardMessageQueues, registry: Registry, origin: NetworkURN) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((tx) => {
        const dest = tx.extrinsic.args[0] as XcmVersionedLocation
        const beneficiary = tx.extrinsic.args[1] as XcmVersionedLocation
        const assets = tx.extrinsic.args[2] as XcmVersionedAssets

        const recipient = networkIdFromVersionedMultiLocation(dest, origin)

        if (recipient) {
          return {
            tx,
            recipient,
            beneficiary,
            assets,
          }
        }

        return null
      }),
      filterNonNull(),
      mergeMap(({ tx, recipient, beneficiary, assets }) => {
        return getDmp(tx.extrinsic.blockHash.toHex(), recipient).pipe(
          map((messages) => {
            const { blockHash, blockNumber, timestamp } = tx.extrinsic
            if (messages.length === 1) {
              const data = messages[0].msg
              const program = asVersionedXcm(data, registry)
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                timestamp,
                recipient,
                data,
                program,
                sender: getSendersFromExtrinsic(tx.extrinsic),
              })
            } else {
              // XXX Temporary matching heuristics until DMP message
              // sent event is implemented.
              // Only matches the first message found.
              for (const message of messages) {
                const data = message.msg
                const program = asVersionedXcm(data, registry)
                if (matchInstructions(program, assets, beneficiary)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    data,
                    program,
                    sender: getSendersFromExtrinsic(tx.extrinsic),
                  })
                }
              }

              return null
            }
          }),
          filterNonNull(),
        )
      }),
    )
  }
}

function findDmpMessagesFromEvent(origin: NetworkURN, getDmp: GetDownwardMessageQueues, registry: Registry) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        if (matchEvent(event, 'xcmPallet', 'Sent')) {
          const { destination, messageId } = event.data as any
          const recipient = networkIdFromMultiLocation(destination, origin)

          if (recipient) {
            return {
              recipient,
              messageId,
              event,
            }
          }
        }

        return null
      }),
      filterNonNull(),
      mergeMap(({ recipient, messageId, event }) => {
        return getDmp(event.blockHash.toHex(), recipient as NetworkURN).pipe(
          map((messages) => {
            const { blockHash, blockNumber, timestamp } = event
            if (messages.length === 1) {
              const data = messages[0].msg
              const program = asVersionedXcm(data, registry)
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                timestamp,
                recipient,
                event,
                data,
                program,
                sender: getSendersFromEvent(event),
              })
            } else {
              // Since we are matching by topic and it is assumed that the TopicId is unique
              // we can break out of the loop on first matching message found.
              for (const message of messages) {
                const data = message.msg
                const program = asVersionedXcm(data, registry)
                if (matchProgramByTopic(program, messageId)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    event,
                    data,
                    program,
                    sender: getSendersFromEvent(event),
                  })
                }
              }

              return null
            }
          }),
          filterNonNull(),
        )
      }),
    )
  }
}

const METHODS_DMP = [
  'limitedReserveTransferAssets',
  'reserveTransferAssets',
  'limitedTeleportAssets',
  'teleportAssets',
]

// legacy support for DMP extrinsics that did not emit xcmPallet.Sent event
export function extractDmpSend(origin: NetworkURN, getDmp: GetDownwardMessageQueues, registry: Registry) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((tx) => {
        const { extrinsic } = tx
        return tx.dispatchError === undefined && matchExtrinsic(extrinsic, 'xcmPallet', METHODS_DMP)
      }),
      findDmpMessagesFromTx(getDmp, registry, origin),
    )
  }
}

export function extractDmpSendByEvent(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  registry: Registry,
) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(findDmpMessagesFromEvent(origin, getDmp, registry))
  }
}

function extractXcmError(outcome: Outcome) {
  if (outcome.isIncomplete) {
    const [_, err] = outcome.asIncomplete
    return err.type.toString()
  }
  if (outcome.isError) {
    return outcome.asError.type.toString()
  }
  return undefined
}

function createDmpReceivedWithContext(event: types.BlockEvent, assetsTrappedEvent?: types.BlockEvent) {
  const xcmMessage = event.data as any
  let outcome: 'Success' | 'Fail' = 'Fail'
  let error: AnyJson
  if (xcmMessage.outcome !== undefined) {
    const o = xcmMessage.outcome as Outcome
    outcome = o.isComplete ? 'Success' : 'Fail'
    error = extractXcmError(o)
  } else if (xcmMessage.success !== undefined) {
    outcome = xcmMessage.success ? 'Success' : 'Fail'
  }

  const messageId = xcmMessage.messageId ? xcmMessage.messageId.toHex() : xcmMessage.id.toHex()
  const messageHash = xcmMessage.messageHash?.toHex() ?? messageId
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)

  return new GenericXcmInboundWithContext({
    event: blockEventToHuman(event),
    blockHash: event.blockHash.toHex(),
    blockNumber: event.blockNumber.toPrimitive(),
    timestamp: event.timestamp?.toNumber(),
    extrinsicId: event.extrinsicId,
    messageHash,
    messageId,
    outcome,
    error,
    assetsTrapped,
  })
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
            : undefined
          return createDmpReceivedWithContext(maybeDmpEvent, assetTrapEvent)
        }
        return null
      }),
      filterNonNull(),
    )
  }
}

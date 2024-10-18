import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@sodazone/ocelloids-sdk'

import { ApiContext, BlockEvent, BlockExtrinsicWithEvents } from '@/services/networking/index.js'
import { HexString, SignerData } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { asSerializable } from '../../base/util.js'
import { GetDownwardMessageQueues } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
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
import { Program, asVersionedXcm } from './xcm-format.js'

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
  program: Program
  blockHash: string
  blockNumber: number
  timestamp?: number
  sender?: SignerData
  event?: BlockEvent
}

// eslint-disable-next-line complexity
function matchInstructions(
  xcmProgram: Program,
  assets: XcmVersionedAssets,
  beneficiary: XcmVersionedLocation,
): boolean {
  const program = xcmProgram.instructions.value as Json[]
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
    blockHash: blockHash as HexString,
    blockNumber: blockNumber,
    timestamp: timestamp,
    event: event ? asSerializable(event) : {},
    recipient,
    instructions: {
      bytes: program.data,
      json: asSerializable(program.instructions),
    },
    messageData: data,
    messageHash: program.hash,
    messageId,
    sender,
  })
}

// Will be obsolete after DMP refactor:
// https://github.com/paritytech/polkadot-sdk/pull/1246
function findDmpMessagesFromTx(getDmp: GetDownwardMessageQueues, context: ApiContext, origin: NetworkURN) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((tx) => {
        const dest = tx.args[0] as XcmVersionedLocation
        const beneficiary = tx.args[1] as XcmVersionedLocation
        const assets = tx.args[2] as XcmVersionedAssets

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
        return getDmp(tx.blockHash as HexString, recipient).pipe(
          map((messages) => {
            const { blockHash, blockNumber, timestamp } = tx
            if (messages.length === 1) {
              const data = messages[0].msg.asBytes()
              const program = asVersionedXcm(data, context)
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                timestamp,
                recipient,
                data,
                program,
                sender: getSendersFromExtrinsic(tx),
              })
            } else {
              // XXX Temporary matching heuristics until DMP message
              // sent event is implemented.
              // Only matches the first message found.
              for (const message of messages) {
                const data = message.msg.asBytes()
                const program = asVersionedXcm(data, context)
                if (matchInstructions(program, assets, beneficiary)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    data,
                    program,
                    sender: getSendersFromExtrinsic(tx),
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

function findDmpMessagesFromEvent(origin: NetworkURN, getDmp: GetDownwardMessageQueues, context: ApiContext) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        if (matchEvent(event, 'XcmPallet', 'Sent')) {
          const { destination, messageId } = event.value
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
        return getDmp(event.blockHash as HexString, recipient as NetworkURN).pipe(
          map((messages) => {
            const { blockHash, blockNumber, timestamp } = event
            if (messages.length === 1) {
              const data = messages[0].msg.asBytes()
              const program = asVersionedXcm(data, context)
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
                const data = message.msg.asBytes()
                const program = asVersionedXcm(data, context)
                if (matchProgramByTopic(program, messageId?.asHex())) {
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
  'LimitedReserveTransferAssets',
  'ReserveTransferAssets',
  'LimitedTeleportAssets',
  'TeleportAssets',
]

// legacy support for DMP extrinsics that did not emit xcmPallet.Sent event
export function extractDmpSend(origin: NetworkURN, getDmp: GetDownwardMessageQueues, context: ApiContext) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((tx) => {
        return tx.dispatchError === undefined && matchExtrinsic(tx, 'XcmPallet', METHODS_DMP)
      }),
      findDmpMessagesFromTx(getDmp, context, origin),
    )
  }
}

export function extractDmpSendByEvent(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  context: ApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(findDmpMessagesFromEvent(origin, getDmp, context))
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

function createDmpReceivedWithContext(event: BlockEvent, assetsTrappedEvent?: BlockEvent) {
  const xcmMessage = event.value
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
    event: asSerializable(event),
    blockHash: event.blockHash as HexString,
    blockNumber: event.blockNumber,
    timestamp: event.timestamp,
    extrinsicPosition: event.extrinsicPosition,
    messageHash,
    messageId,
    outcome,
    error,
    assetsTrapped,
  })
}

export function extractDmpReceive() {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeDmpEvent]) => {
        // in reality we expect a continuous stream of events but
        // in tests, maybeDmpEvent could be undefined if there are odd number of events
        if (
          maybeDmpEvent &&
          (matchEvent(maybeDmpEvent, 'DmpQueue', 'ExecutedDownward') ||
            matchEvent(maybeDmpEvent, 'MessageQueue', 'Processed'))
        ) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'PolkadotXcm', 'AssetsTrapped')
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

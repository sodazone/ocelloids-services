import { bufferCount, filter, map, mergeMap, Observable } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import {
  Block,
  BlockEvent,
  BlockExtrinsicWithEvents,
  SubstrateApiContext,
} from '@/services/networking/substrate/types.js'
import { HexString, SignerData } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  GetDownwardMessageQueues,
  XcmInboundWithContext,
  XcmSentWithContext,
  XcmVersionedInstructions,
} from '../types/index.js'
import {
  getMessageId,
  getSendersFromEvent,
  getSendersFromExtrinsic,
  mapAssetsTrapped,
  matchEvent,
  matchExtrinsic,
  matchProgramByTopic,
  networkIdFromMultiLocation,
} from './util.js'
import { asVersionedXcm, messageHash, Program } from './xcm-format.js'

/*
 ==================================================================================
 NOTICE
 ==================================================================================

 This DMP message matching implementation is provisional and will be replaced
 as soon as possible.

 For details see: https://github.com/paritytech/polkadot-sdk/issues/1905
*/

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
    event,
    txHash: event?.extrinsic?.hash as HexString,
    recipient,
    instructions: {
      bytes: program.data,
      json: program.instructions,
    },
    messageDataBuffer: data,
    messageHash: program.hash,
    messageId,
    sender,
  })
}

function findDmpMessagesFromEvent(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        if (matchEvent(event, 'XcmPallet', 'Sent')) {
          const { destination, message_id } = event.value
          const recipient = networkIdFromMultiLocation(destination, origin)

          if (recipient) {
            return {
              recipient,
              messageId: message_id,
              event,
            }
          }
        }

        return null
      }),
      filterNonNull(),
      mergeMap(({ recipient, messageId, event }) => {
        return getDmp(event.blockHash as HexString, recipient as NetworkURN).pipe(
          mergeMap(async (messages) => {
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
                sender: await getSendersFromEvent(event),
              })
            } else {
              // Since we are matching by topic and it is assumed that the TopicId is unique
              // we can break out of the loop on first matching message found.
              for (const message of messages) {
                const data = message.msg.asBytes()
                const program = asVersionedXcm(data, context)
                if (matchProgramByTopic(program, messageId)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    event,
                    data,
                    program,
                    sender: await getSendersFromEvent(event),
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

function findRecipientLocation(instructions: { type: string; value: any }[]): any {
  for (const instruction of instructions) {
    let dest

    switch (instruction.type) {
      case 'DepositReserveAsset':
      case 'InitiateTeleport':
      case 'TransferReserveAsset':
        dest = instruction.value.dest
        break
      case 'InitiateReserveWithdraw':
        dest = instruction.value.reserve
        break
      default:
        continue
    }

    if (dest) {
      return dest
    }
  }

  return null
}

function findDmpMessagesFromTx(
  getDmp: GetDownwardMessageQueues,
  context: SubstrateApiContext,
  origin: NetworkURN,
) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((tx) => {
        const instructions = (tx.args.message as XcmVersionedInstructions).value
        const recipientLoc = findRecipientLocation(instructions)
        const recipient = networkIdFromMultiLocation(recipientLoc, origin)

        if (recipient) {
          return {
            tx,
            recipient,
          }
        }

        return null
      }),
      filterNonNull(),
      mergeMap(({ tx, recipient }) => {
        return getDmp(tx.blockHash as HexString, recipient).pipe(
          mergeMap(async (messages) => {
            const { blockHash, blockNumber, blockPosition, timestamp, events } = tx
            const xcmPalletAttemptedEvent = events.find((e) => matchEvent(e, 'XcmPallet', 'Attempted'))
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
                event:
                  xcmPalletAttemptedEvent !== undefined
                    ? { ...xcmPalletAttemptedEvent, extrinsic: tx, extrinsicPosition: blockPosition }
                    : undefined,
                sender: await getSendersFromExtrinsic(tx),
              })
            } else {
              // Since we are matching by topic and it is assumed that the TopicId is unique
              // we can break out of the loop on first matching message found.
              for (const message of messages) {
                const data = message.msg.asBytes()
                const program = asVersionedXcm(data, context)
                const messageId = getMessageId(program)
                if (messageId && matchProgramByTopic(program, messageId)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    data,
                    program,
                    event:
                      xcmPalletAttemptedEvent !== undefined
                        ? { ...xcmPalletAttemptedEvent, extrinsic: tx, extrinsicPosition: blockPosition }
                        : undefined,
                    sender: await getSendersFromExtrinsic(tx),
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

// Needed for XcmPallet execute that doesn't emit events
export function extractDmpSendByTx(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((tx) => {
        return tx.dispatchError === undefined && matchExtrinsic(tx, 'XcmPallet', 'execute')
      }),
      findDmpMessagesFromTx(getDmp, context, origin),
    )
  }
}

export function extractDmpSendByEvent(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(findDmpMessagesFromEvent(origin, getDmp, context))
  }
}

function createDmpReceivedWithContext({
  event,
  messageData,
  assetsTrappedEvent,
}: {
  event: BlockEvent
  messageData?: HexString
  assetsTrappedEvent?: BlockEvent
}) {
  const xcmMessage = event.value
  const outcome: 'Success' | 'Fail' = xcmMessage.success ? 'Success' : 'Fail'
  const messageId = xcmMessage.message_id ? xcmMessage.message_id : xcmMessage.id
  const messageHash = xcmMessage.message_hash ?? messageId
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)

  return new GenericXcmInboundWithContext({
    event,
    txHash: event.extrinsic?.hash as HexString,
    blockHash: event.blockHash as HexString,
    blockNumber: event.blockNumber,
    specVersion: event.specVersion,
    timestamp: event.timestamp,
    txPosition: event.extrinsicPosition,
    messageHash,
    messageData,
    messageId,
    outcome,
    assetsTrapped,
  })
}

// Not used. DMP receive is streamed with extractParachainReceive
export function extractDmpReceive() {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeDmpEvent]) => {
        // in reality we expect a continuous stream of events but
        // in tests, maybeDmpEvent could be undefined if there are odd number of events
        if (maybeDmpEvent && matchEvent(maybeDmpEvent, 'MessageQueue', 'Processed')) {
          const assetsTrappedEvent = matchEvent(maybeAssetTrapEvent, 'PolkadotXcm', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined
          return createDmpReceivedWithContext({ event: maybeDmpEvent, assetsTrappedEvent })
        }
        return null
      }),
      filterNonNull(),
    )
  }
}

// Not used. DMP receive is streamed with extractParachainReceive
export function extractDmpReceiveByBlock() {
  return (source: Observable<Block>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      mergeMap(({ hash: blockHash, number: blockNumber, extrinsics, events }) => {
        const timestamp = getTimestampFromBlock(extrinsics)
        const dmpReceived: XcmInboundWithContext[] = []

        // xcm events in block
        const xcmEvents = events.reduce((acc: BlockEvent[], { event }, i) => {
          if (matchEvent(event, 'MessageQueue', 'Processed')) {
            acc.push({
              ...event,
              blockHash,
              blockNumber,
              blockPosition: i,
              timestamp,
            })
          }
          return acc
        }, [])

        // find extrinsic paraInherent...
        const paraExtrinsic = extrinsics.find((ext) =>
          matchExtrinsic(ext, 'ParachainSystem', 'set_validation_data'),
        )
        if (paraExtrinsic) {
          // extract dmpMessages from params
          const {
            data: { downward_messages },
          } = paraExtrinsic.args as {
            data: {
              downward_messages: { msg: HexString; sent_at: number }[]
            }
          }

          // collect downward messages correlated with processed events
          for (const { msg } of downward_messages) {
            const hash = messageHash(msg)
            const index = xcmEvents.findIndex((event) => event.value.id === hash)
            if (index > -1) {
              const event = xcmEvents.splice(index, 1)[0]
              dmpReceived.push(
                createDmpReceivedWithContext({
                  event,
                  messageData: msg,
                }),
              )
            }
          }
        }

        // push the non-matched events
        dmpReceived.push(
          ...xcmEvents.map((event) =>
            createDmpReceivedWithContext({
              event,
            }),
          ),
        )

        return dmpReceived
      }),
      filterNonNull(),
    )
  }
}

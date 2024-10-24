import { Observable, from, map, mergeMap, share } from 'rxjs'

import { getEventValue } from '@/common/util.js'
import {
  Block,
  BlockContext,
  BlockEvent,
  BlockExtrinsic,
  BlockExtrinsicWithEvents,
  EventRecord,
  Extrinsic,
} from '@/services/networking/types.js'

function getTimestampFromBlock(extrinsics: Extrinsic[]): number | undefined {
  const setTimestamp = extrinsics.find(({ module, method }) => module === 'Timestamp' && method === 'set')
  if (setTimestamp) {
    return Number(setTimestamp.args.now)
  }
}

function enhanceTxWithIdAndEvents(
  ctx: BlockContext,
  tx: Extrinsic,
  events: EventRecord[],
): BlockExtrinsicWithEvents {
  const { blockHash, blockNumber, blockPosition, timestamp } = ctx
  const eventsWithId: BlockEvent[] = []

  for (let index = 0; index < events.length; index++) {
    const { phase, event } = events[index]
    if (phase.type === 'ApplyExtrinsic' && phase.value === blockPosition) {
      eventsWithId.push({ ...event, blockHash, blockNumber, blockPosition: index, timestamp })
    }
  }

  const dispatchInfo = getEventValue(
    'System',
    ['ExtrinsicSuccess', 'ExtrinsicFailed'],
    eventsWithId,
  )?.dispatch_info
  const dispatchError = getEventValue('System', 'ExtrinsicFailed', eventsWithId)?.dispatch_error
  // TODO: remove, resolve innerdocs?
  if (dispatchError) {
    console.log(dispatchError.type, dispatchError.value.type)
  }

  return {
    ...tx,
    blockHash,
    blockNumber,
    blockPosition,
    timestamp,
    events: eventsWithId,
    dispatchInfo,
    dispatchError,
  } as BlockExtrinsicWithEvents
}

export function extractTxWithEvents() {
  return (source: Observable<Block>): Observable<BlockExtrinsicWithEvents> => {
    return source.pipe(
      mergeMap(({ hash, number, extrinsics, events }) => {
        const blockNumber = number
        const blockHash = hash
        const timestamp = getTimestampFromBlock(extrinsics)
        return extrinsics.map((xt, blockPosition) => {
          return enhanceTxWithIdAndEvents(
            {
              blockNumber,
              blockHash,
              blockPosition,
              timestamp,
            },
            xt,
            events,
          )
        })
      }),
      share(),
    )
  }
}

export function extractEvents() {
  return (source: Observable<Block>): Observable<BlockEvent> => {
    return source.pipe(
      map(({ hash, number, events, extrinsics }) => {
        return {
          extrinsics,
          events,
          blockNumber: number,
          blockHash: hash,
          timestamp: getTimestampFromBlock(extrinsics),
        }
      }),
      mergeMap(({ extrinsics, events, blockHash, blockNumber, timestamp }) => {
        let prevXtIndex = -1
        let xtEventIndex = 0
        let extrinsicWithId: BlockExtrinsic | undefined
        // TODO: use inner Observable to stream events
        // Loops through each event record in the block and enhance it with block context.
        // If event is emitted from an extrinsic, enhance also with extrinsic context.
        return from(events).pipe(
          map(({ phase, event }, index) => {
            const eventBlockContext: BlockContext = {
              blockNumber,
              blockHash,
              blockPosition: index,
              timestamp,
            }
            const extrinsicIndex = phase.type === 'ApplyExtrinsic' ? phase.value : undefined
            if (extrinsicIndex) {
              if (extrinsicWithId === undefined) {
                extrinsicWithId = {
                  ...extrinsics[extrinsicIndex],
                  blockNumber,
                  blockHash,
                  blockPosition: extrinsicIndex,
                  timestamp,
                }
              }

              const blockEvent: BlockEvent = {
                ...event,
                ...eventBlockContext,
                extrinsic: extrinsicWithId,
                extrinsicPosition: xtEventIndex,
              }

              // If we have moved on to the next extrinsic,
              // reset the event index to 0
              if (extrinsicIndex > prevXtIndex) {
                xtEventIndex = 0
                extrinsicWithId = undefined
              }

              // Increase event index in extrinsic for next loop
              xtEventIndex++
              // Assign current extrinsic index to prevXtIndex
              prevXtIndex = extrinsicIndex

              return blockEvent
            }

            return { ...event, ...eventBlockContext }
          }),
        )
      }),
      share(),
    )
  }
}
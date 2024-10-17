import { Observable, from, map, mergeMap, share } from 'rxjs'

import { Block, BlockContext, BlockEvent, Extrinsic, ExtrinsicWithContext } from '../types.js'

function getTimestampFromBlock(extrinsics: Extrinsic[]): number | undefined {
  const setTimestamp = extrinsics.find(
    ({ module, method }) => module.toLowerCase() === 'timestamp' && method.toLowerCase() === 'set',
  )
  if (setTimestamp) {
    return Number(setTimestamp.args.now)
  }
}

export function extractEvents() {
  return (source: Observable<Block>): Observable<BlockEvent> => {
    return source.pipe(
      map(({ hash, number, events, extrinsics }) => {
        return {
          extrinsics: extrinsics,
          events,
          blockNumber: number,
          blockHash: hash,
          timestamp: getTimestampFromBlock(extrinsics),
        }
      }),
      mergeMap(({ extrinsics, events, blockHash, blockNumber, timestamp }) => {
        let prevXtIndex = -1
        let xtEventIndex = 0
        let extrinsicWithId: ExtrinsicWithContext | undefined
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

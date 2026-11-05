import { map, mergeMap, Observable, share } from 'rxjs'

import { getEventValue } from '@/common/util.js'
import { HexString } from '@/lib.js'

import { isFrontierExtrinsic } from '../evm/decoder.js'
import {
  Block,
  BlockContext,
  BlockEvent,
  BlockExtrinsic,
  BlockExtrinsicWithEvents,
  EventRecord,
  Extrinsic,
} from '../types.js'

const DEFAULT_BATCH_SIZE = 100

export function getTimestampFromBlock(extrinsics: Extrinsic[]): number | undefined {
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
  const { blockHash, blockNumber, blockPosition, timestamp, specVersion } = ctx
  const eventsWithId: BlockEvent[] = []

  for (let index = 0; index < events.length; index++) {
    const { phase, event } = events[index]
    if (phase.type === 'ApplyExtrinsic' && phase.value === blockPosition) {
      eventsWithId.push({ ...event, blockHash, blockNumber, blockPosition: index, specVersion, timestamp })
    }
  }

  const dispatchInfo = getEventValue(
    'System',
    ['ExtrinsicSuccess', 'ExtrinsicFailed'],
    eventsWithId,
  )?.dispatch_info
  const dispatchError = getEventValue('System', 'ExtrinsicFailed', eventsWithId)?.dispatch_error

  return {
    ...tx,
    blockHash,
    blockNumber,
    blockPosition,
    specVersion,
    timestamp,
    events: eventsWithId,
    dispatchInfo,
    dispatchError,
  } as BlockExtrinsicWithEvents
}

export function extractTxWithEvents() {
  return (source: Observable<Block>): Observable<BlockExtrinsicWithEvents> => {
    return source.pipe(
      mergeMap(({ hash, number, extrinsics, events, specVersion }) => {
        const blockNumber = number
        const blockHash = hash
        const timestamp = getTimestampFromBlock(extrinsics)

        return new Observable<BlockExtrinsicWithEvents>((subscriber) => {
          let index = 0
          const batchSize = DEFAULT_BATCH_SIZE

          function processBatch() {
            try {
              const end = Math.min(index + batchSize, extrinsics.length)
              for (; index < end; index++) {
                subscriber.next(
                  enhanceTxWithIdAndEvents(
                    {
                      blockNumber,
                      blockHash,
                      blockPosition: index,
                      specVersion,
                      timestamp,
                    },
                    extrinsics[index],
                    events,
                  ),
                )
              }
              if (index < extrinsics.length) {
                setImmediate(processBatch)
              } else {
                subscriber.complete()
              }
            } catch (error) {
              subscriber.error(error)
            }
          }

          processBatch()
        })
      }),
      share(),
    )
  }
}

export function extractEvents() {
  return (source: Observable<Block>): Observable<BlockEvent> => {
    return source.pipe(
      map(({ hash, number, events, extrinsics, specVersion }) => {
        return {
          extrinsics,
          events,
          blockNumber: number,
          blockHash: hash,
          specVersion,
          timestamp: getTimestampFromBlock(extrinsics),
        }
      }),
      mergeMap(({ extrinsics, events, blockHash, blockNumber, specVersion, timestamp }) => {
        // Allow GC breathing room between batches
        return new Observable<BlockEvent>((subscriber) => {
          let prevXtIndex = -1
          let xtEventIndex = 0
          let extrinsicWithId: BlockExtrinsic | undefined
          let index = 0
          const batchSize = DEFAULT_BATCH_SIZE

          function processBatch() {
            try {
              const end = Math.min(index + batchSize, events.length)
              for (; index < end; index++) {
                const { phase, event } = events[index]
                const eventBlockContext: BlockContext = {
                  blockNumber,
                  blockHash,
                  blockPosition: index,
                  specVersion,
                  timestamp,
                }
                const extrinsicIndex = phase.type === 'ApplyExtrinsic' ? phase.value : undefined
                if (extrinsicIndex !== undefined && extrinsicIndex < extrinsics.length) {
                  if (extrinsicWithId === undefined || prevXtIndex !== extrinsicIndex) {
                    const xt = extrinsics[extrinsicIndex]
                    extrinsicWithId = {
                      ...xt,
                      blockNumber,
                      blockHash,
                      blockPosition: extrinsicIndex,
                      specVersion,
                      timestamp,
                    }
                    if (isFrontierExtrinsic(xt)) {
                      const evmEvent = events.find(
                        ({ phase, event }) =>
                          phase.type === 'ApplyExtrinsic' &&
                          phase.value === extrinsicIndex &&
                          event.module === 'Ethereum' &&
                          event.name === 'Executed',
                      )
                      if (evmEvent) {
                        extrinsicWithId.evmTxHash = (
                          evmEvent.event.value as { transaction_hash: HexString }
                        ).transaction_hash
                      }
                    }
                  }

                  const blockEvent: BlockEvent = {
                    ...event,
                    ...eventBlockContext,
                    extrinsic: extrinsicWithId,
                    extrinsicPosition: xtEventIndex,
                  }

                  if (extrinsicIndex > prevXtIndex) {
                    xtEventIndex = 0
                    extrinsicWithId = undefined
                  }

                  xtEventIndex++
                  prevXtIndex = extrinsicIndex

                  subscriber.next(blockEvent)
                } else {
                  subscriber.next({ ...event, ...eventBlockContext })
                }
              }

              if (index < events.length) {
                setImmediate(processBatch)
              } else {
                subscriber.complete()
              }
            } catch (error) {
              subscriber.error(error)
            }
          }

          processBatch()
        })
      }),
      share(),
    )
  }
}

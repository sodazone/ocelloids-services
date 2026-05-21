import { filter, map, mergeMap, Observable } from 'rxjs'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { routerExecutedHandler } from './router.js'
import { EventHandler, EventRecordWithIndex, HydrationDefiEvent } from './types.js'

const handlers: Record<string, EventHandler> = {
  'extrinsic.router.executed': routerExecutedHandler,
}

function toHandlerKey(event: BlockEvent, isExtrinsicEvent: boolean) {
  return `${isExtrinsicEvent ? 'extrinsic' : 'intrinsic'}.${event.module.toLowerCase()}.${event.name.toLowerCase()}`
}

export function watchEvents(logger: Logger) {
  return (source$: Observable<Block>): Observable<HydrationDefiEvent> =>
    source$.pipe(
      mergeMap(({ events, extrinsics, hash, number, specVersion }) => {
        const timestamp = getTimestampFromBlock(extrinsics)
        const eventsWithIndex: EventRecordWithIndex[] = events.map((e, i) => ({ ...e, index: i }))
        return eventsWithIndex.map(({ event, phase, index }) => {
          const isApplyExtrinsic = phase.type === 'ApplyExtrinsic'
          const extrinsic = isApplyExtrinsic ? extrinsics[phase.value] : undefined
          const siblings = isApplyExtrinsic
            ? events.filter((e) => e.phase.type === phase.type && e.phase.value === phase.value)
            : events.filter((e) => e.phase.type === phase.type)
          return [
            {
              ...event,
              extrinsic,
              blockNumber: number,
              blockHash: hash,
              blockPosition: index,
              specVersion,
              timestamp,
            },
            siblings,
            isApplyExtrinsic,
          ] as [BlockEvent, EventRecordWithIndex[], boolean]
        })
      }),
      map(([event, siblings, isExtrinsicEvent]) => {
        const key = toHandlerKey(event, isExtrinsicEvent)
        const handler = handlers[key]
        if (!handler) {
          return null
        }
        try {
          return handler(event, siblings)
        } catch (e) {
          logger.warn(e, `Error handling event ${key}`)
          return null
        }
      }),
      filter((defiEvent) => defiEvent !== null),
    )
}

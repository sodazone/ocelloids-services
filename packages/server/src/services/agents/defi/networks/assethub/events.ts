import { filter, map, mergeMap, Observable } from 'rxjs'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent, Event, EventRecordWithIndex } from '@/services/networking/substrate/types.js'
import { DefiEventPayload } from '../../types.js'

const ASSET_CONVERSION_MODULE = 'assetconversion'
const ASSET_CONVERSION_EVENTS = ['swapcreditexecuted', 'swapexecuted']

export function watchEvents() {
  return (source$: Observable<Block>): Observable<DefiEventPayload> =>
    source$.pipe(
      mergeMap(({ events, extrinsics, hash, number, specVersion }) => {
        const timestamp = getTimestampFromBlock(extrinsics)
        const eventsWithIndex: EventRecordWithIndex<Event>[] = events.map((e, i) => ({ ...e, index: i }))
        return eventsWithIndex.map(({ event, phase, index }) => {
          const isApplyExtrinsic = phase.type === 'ApplyExtrinsic'
          const extrinsic = isApplyExtrinsic ? extrinsics[phase.value] : undefined
          const siblings = isApplyExtrinsic
            ? eventsWithIndex.filter((e) => e.phase.type === phase.type && e.phase.value === phase.value)
            : eventsWithIndex.filter((e) => e.phase.type === phase.type)
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
          ] as [BlockEvent, EventRecordWithIndex<Event>[]]
        })
      }),
      filter(
        ([e]) =>
          e.module.toLowerCase() === ASSET_CONVERSION_MODULE &&
          ASSET_CONVERSION_EVENTS.includes(e.name.toLowerCase()),
      ),
      map(([event, siblings]) => {
        return null
      }),
      filter((e) => e !== null),
    )
}

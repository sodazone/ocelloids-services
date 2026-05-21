import { EMPTY, filter, from, map, mergeMap, Observable } from 'rxjs'
import { formatUnits } from 'viem'
import { AssetId, AssetMetadata } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload } from '../../../types.js'
import { CHAIN_ID, PROTOCOL_NAME } from '../consts.js'
import { routerExecutedHandler } from './router.js'
import { EventHandler, EventRecordWithIndex, SwapRoute } from './types.js'

const handlers: Record<string, EventHandler> = {
  'extrinsic.router.executed': routerExecutedHandler,
}

function toHandlerKey(event: BlockEvent, isExtrinsicEvent: boolean) {
  return `${isExtrinsicEvent ? 'extrinsic' : 'intrinsic'}.${event.module.toLowerCase()}.${event.name.toLowerCase()}`
}

function toSwapEventPayload(
  name: 'swap' | 'swap_intent',
  { assetIn, assetOut, amountIn, amountOut, marketId }: SwapRoute,
  { blockNumber, txHash, who }: { blockNumber: string; txHash: string; who: string },
  metadataMap: Map<AssetId, AssetMetadata>,
): DefiEventPayload | null {
  const assetInMeta = metadataMap.get(assetIn)
  const assetOutMeta = metadataMap.get(assetOut)

  if (!assetInMeta || !assetOutMeta) {
    return null
  }

  return {
    type: 'event',
    networkId: CHAIN_ID,
    protocol: PROTOCOL_NAME,
    blockNumber,
    txHash,
    name,
    marketId,
    data: {
      origin: who,
      in: {
        amount: formatUnits(amountIn, assetInMeta.decimals ?? 0),
        assetId: assetIn.toString(),
        symbol: assetInMeta.symbol ?? '??',
      },
      out: {
        amount: formatUnits(amountOut, assetOutMeta.decimals ?? 0),
        assetId: assetOut.toString(),
        symbol: assetOutMeta.symbol ?? '??',
      },
    },
  }
}

export function watchEvents(
  logger: Logger,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
) {
  return (source$: Observable<Block>): Observable<DefiEventPayload> =>
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
      mergeMap((event) => {
        if (event.type !== 'swap') {
          return EMPTY
        }

        const { assetIn, assetOut, route, blockNumber, extrinsic, who } = event
        const assetIds = [
          ...new Set([
            assetIn.toString(),
            assetOut.toString(),
            ...route.flatMap((r) => [r.assetIn.toString(), r.assetOut.toString()]),
          ]),
        ]

        return from(fetchAssetMetadata(assetIds)).pipe(
          mergeMap((results) => {
            const metadataMap = new Map<AssetId, AssetMetadata>(results.map((meta) => [meta.id, meta]))

            const swapCtx = {
              who,
              blockNumber: blockNumber.toString(),
              txHash: extrinsic?.txHash ?? 'intrinsic',
            }

            const internalSwaps = route
              .map((r) => toSwapEventPayload('swap', r, swapCtx, metadataMap))
              .filter((r): r is DefiEventPayload => r !== null)

            const swapIntentEvent = toSwapEventPayload('swap_intent', event, swapCtx, metadataMap)

            if (swapIntentEvent === null) {
              return [...internalSwaps]
            }

            return [swapIntentEvent, ...internalSwaps]
          }),
        )
      }),
    )
}

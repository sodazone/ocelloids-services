import { EMPTY, filter, from, map, mergeMap, Observable } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { AssetId, AssetMetadata } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload, SwapIntentStatus } from '../../../types.js'
import { CHAIN_ID, PROTOCOL_NAME } from '../consts.js'
import { evmLogHandler } from './evm.js'
import { routerExecutedHandler } from './router.js'
import {
  EventHandler,
  EventRecordWithIndex,
  HydrationLendingEvent,
  HydrationSwapEvent,
  SwapRoute,
} from './types.js'

const baseEventPayload: Pick<DefiEventPayload, 'type' | 'networkId'> = {
  type: 'event',
  networkId: CHAIN_ID,
}

const handlers: Record<string, EventHandler> = {
  'extrinsic.router.executed': routerExecutedHandler,
  'extrinsic.evm.log': evmLogHandler,
}

function toHandlerKey(event: BlockEvent, isExtrinsicEvent: boolean) {
  return `${isExtrinsicEvent ? 'extrinsic' : 'intrinsic'}.${event.module.toLowerCase()}.${event.name.toLowerCase()}`
}

function toSwapEventPayload(
  name: 'swap' | 'swap_intent',
  { assetIn, assetOut, amountIn, amountOut, marketId, protocol: swapProtocol }: SwapRoute,
  {
    blockHash,
    blockNumber,
    txHash,
    who,
    status,
  }: { blockNumber: string; blockHash: string; txHash: string; who: string; status: SwapIntentStatus },
  metadataMap: Map<AssetId, AssetMetadata>,
): DefiEventPayload | null {
  const assetInMeta = metadataMap.get(assetIn)
  const assetOutMeta = metadataMap.get(assetOut)

  if (!assetInMeta || !assetOutMeta) {
    return null
  }

  const protocol = `${PROTOCOL_NAME}.${swapProtocol}`

  if (name === 'swap') {
    return {
      ...baseEventPayload,
      id: ulid(),
      protocol,
      name,
      blockNumber,
      blockHash,
      txHash,
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

  return {
    ...baseEventPayload,
    id: ulid(),
    protocol,
    name,
    blockNumber,
    blockHash,
    txHash,
    marketId,
    status,
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

function mapLending(
  { amount, asset, action, blockHash, blockNumber, marketId, extrinsic, who, protocol }: HydrationLendingEvent,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
): Observable<DefiEventPayload> {
  const assetIdAsString = asset.toString()
  return from(fetchAssetMetadata([assetIdAsString])).pipe(
    map((results) => {
      if (results.length === 0) {
        return null
      }
      const assetMeta = results[0]
      return {
        ...baseEventPayload,
        id: ulid(),
        name: action,
        protocol: `${PROTOCOL_NAME}.${protocol}`,
        blockNumber: blockNumber.toString(),
        blockHash,
        txHash: extrinsic ? extrinsic.txHash : null,
        marketId,
        data: {
          provider: who,
          assets: [
            {
              amount: formatUnits(amount, assetMeta.decimals ?? 0),
              assetId: assetIdAsString,
              symbol: assetMeta.symbol ?? '??',
            },
          ],
        },
      }
    }),
    filter((ev) => ev !== null),
  )
}

function mapSwaps(
  event: HydrationSwapEvent,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
) {
  const { assetIn, assetOut, route, blockNumber, blockHash, extrinsic, who } = event
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

      const swapCtx: {
        blockNumber: string
        blockHash: string
        txHash: string
        who: string
        status: SwapIntentStatus
      } = {
        who,
        blockNumber: blockNumber.toString(),
        blockHash,
        txHash: extrinsic?.txHash ?? 'intrinsic',
        status: 'filled',
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
        if (event.type === 'swap') {
          return mapSwaps(event, fetchAssetMetadata)
        }
        if (event.type === 'lending') {
          return mapLending(event, fetchAssetMetadata)
        }

        return EMPTY
      }),
    )
}

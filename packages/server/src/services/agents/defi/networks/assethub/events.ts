import { filter, mergeMap, Observable } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import {
  Block,
  BlockEvent,
  Event,
  EventRecordWithIndex,
  XcmLocation,
} from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload } from '../../types.js'
import { CHAIN_ID, isBaseToken, PROTOCOL } from './common.js'
import { AssetConversionPool, AssetIdentifier } from './types.js'

const ASSET_CONVERSION_MODULE = 'assetconversion'
const SWAP_CREDIT_EVENT = 'swapcreditexecuted'
const SWAP_EVENT = 'swapexecuted'

type SwapCreditExecuted = {
  amount_in: bigint
  amount_out: bigint
  path: [XcmLocation, bigint][]
}

type SwapExecuted = {
  who: string
  send_to: string
  amount_in: bigint
  amount_out: bigint
  path: [XcmLocation, bigint][]
}

type AssetDeposited = {
  asset_id: number
  who: string
  amount: bigint
}

type ForeignAssetDeposited = {
  asset_id: XcmLocation
  who: string
  amount: bigint
}

type PathNode = [XcmLocation, bigint]

function getSwapSegments(path: PathNode[]): [PathNode, PathNode][] {
  const segments: [PathNode, PathNode][] = []

  for (let i = 0; i < path.length - 1; i++) {
    segments.push([path[i], path[i + 1]])
  }

  return segments
}

export function createEventWatcher({
  logger,
  getPrice,
  getPool,
  getMetadata,
}: {
  logger: Logger
  getPrice: (token: AssetIdentifier) => number | undefined
  getPool: (quoteToken: XcmLocation) => AssetConversionPool | undefined
  getMetadata: (location: XcmLocation) => AssetMetadata | undefined
}) {
  function mapSwapSegements(
    segments: [PathNode, PathNode][],
    event: BlockEvent,
    who: string,
  ): DefiEventPayload[] {
    const allSwapEvents: DefiEventPayload[] = []

    for (const [inToken, outToken] of segments) {
      const [inLocation, inAmount] = inToken
      const [outLocation, outAmount] = outToken

      const quoteTokenLoc = isBaseToken(inLocation) ? outLocation : inLocation
      const pool = getPool(quoteTokenLoc)

      if (!pool) {
        logger.warn('No pool found for quote token %o', quoteTokenLoc)
        continue
      }

      const assetInMeta = getMetadata(inLocation)
      const assetOutMeta = getMetadata(outLocation)

      if (!assetInMeta || !assetOutMeta) {
        logger.warn('No metadata found for token %o', assetInMeta === undefined ? inLocation : outLocation)
        continue
      }

      const normalizedAmountIn = formatUnits(inAmount, assetInMeta.decimals ?? 0)
      const normalizedAmountOut = formatUnits(outAmount, assetOutMeta.decimals ?? 0)

      const assetInPrice =
        getPrice({ chainId: assetInMeta.chainId, id: normalizeAssetId(assetInMeta.id) }) ?? 0
      const assetOutPrice =
        getPrice({ chainId: assetOutMeta.chainId, id: normalizeAssetId(assetOutMeta.id) }) ?? 0

      const p: DefiEventPayload = {
        id: ulid(),
        type: 'event',
        networkId: CHAIN_ID,
        protocol: PROTOCOL,
        name: 'swap',
        marketId: pool.owner,
        blockHash: event.blockHash,
        blockNumber: event.blockNumber.toString(),
        txHash: event.extrinsic?.hash ?? null,
        data: {
          origin: asPublicKey(who),
          in: {
            amount: normalizedAmountIn,
            assetId: toAssetId(assetInMeta.chainId, normalizeAssetId(assetInMeta.id)),
            symbol: assetInMeta.symbol ?? '??',
            amountUSD: Number(normalizedAmountIn) * assetInPrice,
          },
          out: {
            amount: normalizedAmountOut,
            assetId: toAssetId(assetOutMeta.chainId, normalizeAssetId(assetOutMeta.id)),
            symbol: assetOutMeta.symbol ?? '??',
            amountUSD: Number(normalizedAmountOut) * assetOutPrice,
          },
        },
      }

      allSwapEvents.push(p)
    }

    return allSwapEvents
  }

  function handleSwapCreditEvent(
    event: BlockEvent,
    siblings: EventRecordWithIndex<Event>[],
  ): DefiEventPayload[] {
    const assetDepositEvent = siblings.find(
      (s) =>
        s.index === event.blockPosition - 1 &&
        s.event.name.toLowerCase() === 'deposited' &&
        ['assets', 'foreignassets'].includes(s.event.module.toLowerCase()),
    )
    if (!assetDepositEvent) {
      logger.warn('No asset deposit event found in event %s-%s', event.blockNumber, event.blockPosition)
      return []
    }

    const { who } = assetDepositEvent.event.value as AssetDeposited | ForeignAssetDeposited
    const { path } = event.value as SwapCreditExecuted
    const segments = getSwapSegments(path)

    return mapSwapSegements(segments, event, who)
  }

  function handleSwapEvent(event: BlockEvent, siblings: EventRecordWithIndex<Event>[]): DefiEventPayload[] {
    const { path, who } = event.value as SwapExecuted
    const segments = getSwapSegments(path)
    return mapSwapSegements(segments, event, who)
  }

  function watchEvents() {
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
        filter(([e]) => e.module.toLowerCase() === ASSET_CONVERSION_MODULE),
        mergeMap(([event, siblings]) => {
          if (event.name.toLowerCase() === SWAP_CREDIT_EVENT) {
            return handleSwapCreditEvent(event, siblings)
          }
          if (event.name.toLowerCase() === SWAP_EVENT) {
            return handleSwapEvent(event, siblings)
          }
          logger.info(
            '[defi:assethub] unhandled event %s.%s (#%s)',
            event.module,
            event.name,
            event.blockNumber,
          )
          return []
        }),
      )
  }

  return { watchEvents }
}

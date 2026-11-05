import { mergeMap, Observable } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent, Event, EventRecord, XcmLocation } from '@/services/networking/substrate/types.js'
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
        logger.warn('[defi:assethub] No pool found for quote token %o', quoteTokenLoc)
        continue
      }

      const assetInMeta = getMetadata(inLocation)
      const assetOutMeta = getMetadata(outLocation)

      if (!assetInMeta || !assetOutMeta) {
        logger.warn(
          '[defi:assethub] No metadata found for token %o',
          assetInMeta === undefined ? inLocation : outLocation,
        )
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

  function findSwapCreditDepositor(events: EventRecord<Event>[], index: number): string | undefined {
    const prev = events[index - 1]
    if (!prev) {
      return
    }

    const current = events[index]

    if (
      prev.phase.type !== current.phase.type ||
      ('value' in prev.phase && 'value' in current.phase && prev.phase.value !== current.phase.value)
    ) {
      return
    }

    if (
      prev.event.name.toLowerCase() !== 'deposited' ||
      !['assets', 'foreignassets'].includes(prev.event.module.toLowerCase())
    ) {
      return
    }

    return (prev.event.value as AssetDeposited | ForeignAssetDeposited).who
  }

  function handleSwapCreditEvent(events: EventRecord<Event>[], blockEvent: BlockEvent): DefiEventPayload[] {
    try {
      const who = findSwapCreditDepositor(events, blockEvent.blockPosition)

      if (!who) {
        logger.warn(
          '[defi:assethub] No asset deposit event found in event %s-%s',
          blockEvent.blockNumber,
          blockEvent.blockPosition,
        )
        return []
      }

      const { path } = blockEvent.value as SwapCreditExecuted
      const segments = getSwapSegments(path)

      return mapSwapSegements(segments, blockEvent, who)
    } catch (e) {
      logger.error(
        e,
        '[defi:assethub] Error mapping swap credit event at block %s #%s',
        blockEvent.blockHash,
        blockEvent.blockNumber,
      )
      return []
    }
  }

  function handleSwapEvent(event: BlockEvent): DefiEventPayload[] {
    try {
      const { path, who } = event.value as SwapExecuted
      const segments = getSwapSegments(path)
      return mapSwapSegements(segments, event, who)
    } catch (e) {
      logger.error(
        e,
        '[defi:assethub] Error mapping swap event at block %s #%s',
        event.blockHash,
        event.blockNumber,
      )
      return []
    }
  }

  function* extractSwaps(block: Block): Generator<DefiEventPayload> {
    const { events, extrinsics, hash, number, specVersion } = block

    // Only computed if the block actually contains a relevant event.
    let timestamp: ReturnType<typeof getTimestampFromBlock> | undefined
    let timestampResolved = false

    for (let index = 0; index < events.length; index++) {
      const { event, phase } = events[index]

      if (event.module.toLowerCase() !== ASSET_CONVERSION_MODULE) {
        continue
      }

      const name = event.name.toLowerCase()
      if (name !== SWAP_CREDIT_EVENT && name !== SWAP_EVENT) {
        logger.info('[defi:assethub] unhandled event %s.%s (#%s)', event.module, event.name, number)
        continue
      }

      if (!timestampResolved) {
        timestamp = getTimestampFromBlock(extrinsics)
        timestampResolved = true
      }

      const blockEvent: BlockEvent = {
        ...event,
        extrinsic: phase.type === 'ApplyExtrinsic' ? extrinsics[phase.value] : undefined,
        blockNumber: number,
        blockHash: hash,
        blockPosition: index,
        specVersion,
        timestamp,
      } as BlockEvent

      yield* name === SWAP_CREDIT_EVENT
        ? handleSwapCreditEvent(events, blockEvent)
        : handleSwapEvent(blockEvent)
    }
  }

  function watchEvents() {
    return (source$: Observable<Block>): Observable<DefiEventPayload> =>
      source$.pipe(mergeMap((block) => extractSwaps(block)))
  }

  return { watchEvents }
}

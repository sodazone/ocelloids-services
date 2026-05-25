import { EMPTY, filter, forkJoin, from, map, mergeMap, Observable } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { SubstrateAccountMetadata } from '@/services/agents/steward/lib.js'
import { AssetId, AssetMetadata, Empty } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload, MoneyMarketActions, SwapIntentStatus } from '../../../types.js'
import { CHAIN_ID, PROTOCOL_NAME } from '../consts.js'
import { evmLogHandler } from './evm.js'
import { routerExecutedHandler } from './router.js'
import {
  EventHandler,
  EventRecordWithIndex,
  HydrationLendingEvent,
  HydrationLiquidationEvent,
  HydrationSwapEvent,
  SwapRoute,
} from './types.js'

const eventPayloadConsts: Pick<DefiEventPayload, 'type' | 'networkId'> = {
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

function resolveAssets(ids: string[], fetchAssetMetadata: (ids: string[]) => Promise<AssetMetadata[]>) {
  return from(fetchAssetMetadata(ids)).pipe(map((assets) => new Map(assets.map((a) => [a.id, a]))))
}

function resolveAccounts(
  accounts: string[],
  fetchAccounts: (a: string[]) => Promise<SubstrateAccountMetadata[]>,
) {
  return from(fetchAccounts(accounts)).pipe(
    map((res) => {
      const map = new Map<string, string>()

      accounts.forEach((addr, i) => {
        map.set(addr, res[i]?.publicKey ?? addr)
      })

      return map
    }),
  )
}

function basePayload(overrides: Omit<DefiEventPayload, 'type' | 'data' | 'id' | 'networkId' | 'name'>) {
  return {
    id: ulid(),
    ...eventPayloadConsts,
    ...overrides,
  }
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
      ...eventPayloadConsts,
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
    ...eventPayloadConsts,
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
  event: HydrationLendingEvent,
  fetchAssetMetadata: any,
  fetchAccounts: any,
): Observable<DefiEventPayload> {
  const assetId = event.asset.toString()

  return forkJoin({
    assets: resolveAssets([assetId], fetchAssetMetadata),
    accounts: resolveAccounts([event.who], fetchAccounts),
  }).pipe(
    map(({ assets, accounts }) => {
      const assetMeta = assets.get(assetId)
      if (!assetMeta) {
        return null
      }

      return {
        ...basePayload({
          protocol: `${PROTOCOL_NAME}.${event.protocol}`,
          blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash ?? null,
          marketId: event.marketId,
        }),
        name: event.action as MoneyMarketActions,
        data: {
          provider: accounts.get(event.who)!,
          assets: [
            {
              amount: formatUnits(event.amount, assetMeta.decimals ?? 0),
              assetId,
              symbol: assetMeta.symbol ?? '??',
            },
          ],
        },
      }
    }),
    filter((ev) => ev !== null),
  )
}

function mapLiquidation(
  event: HydrationLiquidationEvent,
  fetchAssetMetadata: any,
  fetchAccounts: any,
): Observable<DefiEventPayload> {
  const debtId = event.debtAsset.toString()
  const colId = event.collateralAsset.toString()
  const name = 'liquidate' as const

  return forkJoin({
    assets: resolveAssets([debtId, colId], fetchAssetMetadata),
    accounts: resolveAccounts([event.who, event.counterparty], fetchAccounts),
  }).pipe(
    map(({ assets, accounts }) => {
      const debt = assets.get(debtId)
      const collateral = assets.get(colId)
      if (!debt || !collateral) {
        return null
      }

      return {
        ...basePayload({
          protocol: `${PROTOCOL_NAME}.${event.protocol}`,
          blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash ?? null,
          marketId: event.marketId,
        }),
        name,
        data: {
          origin: accounts.get(event.who)!,
          counterparty: accounts.get(event.counterparty)!,
          debt: {
            amount: formatUnits(event.debtCovered, debt.decimals ?? 0),
            assetId: debtId,
            symbol: debt.symbol ?? '??',
          },
          collateral: {
            amount: formatUnits(event.collateralLiquidated, collateral.decimals ?? 0),
            assetId: colId,
            symbol: collateral.symbol ?? '??',
          },
        },
      }
    }),
    filter((ev) => ev !== null),
  )
}

function mapSwaps(event: HydrationSwapEvent, fetchAssetMetadata: any) {
  const ids = [
    event.assetIn.toString(),
    event.assetOut.toString(),
    ...event.route.flatMap((r) => [r.assetIn.toString(), r.assetOut.toString()]),
  ]

  return resolveAssets([...new Set(ids)], fetchAssetMetadata).pipe(
    mergeMap((assets) => {
      const ctx = {
        who: event.who,
        blockNumber: event.blockNumber.toString(),
        blockHash: event.blockHash,
        txHash: event.extrinsic?.txHash ?? 'intrinsic',
        status: 'filled' as const,
      }

      const route = event.route
        .map((r) => toSwapEventPayload('swap', r, ctx, assets))
        .filter((s) => s !== null)

      const intent = toSwapEventPayload('swap_intent', event, ctx, assets)

      return intent ? [intent, ...route] : route
    }),
  )
}

export function watchEvents(
  logger: Logger,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>,
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
          return mapLending(event, fetchAssetMetadata, fetchAccounts)
        }
        if (event.type === 'liquidation') {
          return mapLiquidation(event, fetchAssetMetadata, fetchAccounts)
        }

        return EMPTY
      }),
    )
}

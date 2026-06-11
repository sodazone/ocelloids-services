import { EMPTY, filter, forkJoin, from, map, mergeMap, Observable, of } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { toAssetId } from '@/services/agents/common/assets.js'
import { SubstrateAccountMetadata } from '@/services/agents/steward/lib.js'
import { AssetId, AssetMetadata, Empty, isAccountMetadata } from '@/services/agents/steward/types.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { Block, BlockEvent, Event, EventRecordWithIndex } from '@/services/networking/substrate/types.js'
import { Logger } from '@/services/types.js'
import { DefiEventPayload, DefiOrderPayload, MoneyMarketActions } from '../../../types.js'
import { CHAIN_ID } from '../consts.js'
import { toProtocol } from '../utils.js'
import { evmLogHandler } from './evm.js'
import { swapped3Handler } from './router.js'
import {
  EventHandler,
  HydrationDcaEvent,
  HydrationDcaExecutedEvent,
  HydrationLendingEvent,
  HydrationLiquidationEvent,
  HydrationSwapEvent,
  HydrationSwapped3Event,
  SwapRoute,
} from './types.js'

const eventPayloadConsts: Pick<DefiEventPayload, 'type' | 'networkId'> = {
  type: 'event',
  networkId: CHAIN_ID,
}

const handlers: Record<string, EventHandler> = {
  // 'router.executed': routerExecutedHandler,
  'evm.log': evmLogHandler,
  // 'dca.tradeexecuted': dcaExecutedHandler,
  // 'dca.scheduled': dcaScheduledHandler,
  // 'dca.completed': dcaCompletedHandler,
  'broadcast.swapped3': swapped3Handler,
}

function toHandlerKey(event: BlockEvent) {
  return `${event.module.toLowerCase()}.${event.name.toLowerCase()}`
}

function resolveAssets(ids: string[], fetchAssetMetadata: (ids: string[]) => Promise<AssetMetadata[]>) {
  return from(fetchAssetMetadata(ids)).pipe(map((assets) => new Map(assets.map((a) => [a.id, a]))))
}

function resolveAccounts(
  accounts: string[],
  fetchAccounts: (a: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>,
) {
  return from(fetchAccounts(accounts)).pipe(
    map((res) => {
      const map = new Map<string, string>()

      accounts.forEach((addr, i) => {
        const result = res[i]
        if (isAccountMetadata(result)) {
          map.set(addr, result.publicKey ?? addr)
        } else {
          map.set(addr, addr)
        }
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
  { assetIn, assetOut, amountIn, amountOut, marketId, protocol: swapProtocol }: SwapRoute,
  {
    blockHash,
    blockNumber,
    txHash,
    who,
  }: { blockNumber: string; blockHash: string; txHash: string; who: string },
  metadataMap: Map<AssetId, AssetMetadata>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
): DefiEventPayload | null {
  const assetInMeta = metadataMap.get(assetIn)
  const assetOutMeta = metadataMap.get(assetOut)

  if (!assetInMeta || !assetOutMeta) {
    return null
  }
  const normalizedAmountIn = formatUnits(amountIn, assetInMeta.decimals ?? 0)
  const normalizedAmountOut = formatUnits(amountOut, assetOutMeta.decimals ?? 0)
  const outUSD = computeUsdValue(assetOut, Number(normalizedAmountOut))
  // If input is H2O, use outUSD since we don't compute price of H2O
  const inUSD = assetIn === 1 ? outUSD : computeUsdValue(assetIn, Number(normalizedAmountIn))

  return {
    ...basePayload({
      protocol: toProtocol(swapProtocol),
      blockNumber: blockNumber.toString(),
      blockHash,
      txHash,
      marketId,
    }),
    name: 'swap',
    data: {
      origin: who,
      in: {
        amount: normalizedAmountIn,
        assetId: toAssetId(CHAIN_ID, assetIn),
        symbol: assetInMeta.symbol ?? '??',
        amountUSD: inUSD,
      },
      out: {
        amount: normalizedAmountOut,
        assetId: toAssetId(CHAIN_ID, assetOut),
        symbol: assetOutMeta.symbol ?? '??',
        amountUSD: outUSD,
      },
    },
  }
}

function mapSwapToOrderPayload(
  event: HydrationSwapEvent | HydrationDcaExecutedEvent,
  metadataMap: Map<AssetId, AssetMetadata>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
): DefiOrderPayload | null {
  const assetInMeta = metadataMap.get(event.assetIn)
  const assetOutMeta = metadataMap.get(event.assetOut)

  if (!assetInMeta || !assetOutMeta) {
    return null
  }
  const amountIn = formatUnits(event.amountIn, assetInMeta.decimals ?? 0)
  const amountOut = formatUnits(event.amountOut, assetOutMeta.decimals ?? 0)
  const usdIn = computeUsdValue(event.assetIn, Number(amountIn))
  const usdOut = computeUsdValue(event.assetOut, Number(amountOut))
  const avgAmountUSD = usdIn && usdOut ? (usdIn + usdOut) / 2 : (usdIn ?? usdOut)
  const blockNumber = event.blockNumber.toString()
  const timestamp = event.timestamp ?? Date.now()

  const fill = {
    filler: event.who,
    assetIn: event.assetIn.toString(),
    assetOut: event.assetOut.toString(),
    symbolIn: assetInMeta.symbol ?? '??',
    symbolOut: assetOutMeta.symbol ?? '??',
    amountIn,
    amountOut,
    amountUSD: avgAmountUSD ? avgAmountUSD.toString() : undefined,
    blockNumber,
    blockHash: event.blockHash,
    eventIndex: event.event.blockPosition,
    timestamp,
    txHash: event.extrinsic?.txHash,
  }

  const order =
    event.type === 'swap'
      ? {
          assetIn: event.assetIn.toString(),
          assetOut: event.assetOut.toString(),
          symbolIn: assetInMeta.symbol ?? '??',
          symbolOut: assetOutMeta.symbol ?? '??',
          createdAtBlock: blockNumber,
          createdAt: timestamp,
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash,
          amountIn,
          amountOut,
        }
      : undefined

  return {
    type: 'order',
    networkId: CHAIN_ID,
    orderId: event.orderId,
    owner: event.who,
    protocol: event.type === 'swap' ? event.protocol : 'dca',
    status: event.status,
    blockNumber,
    timestamp,
    fill,
    creation: order,
  }
}

function mapDca(
  event: HydrationDcaEvent,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
): Observable<DefiEventPayload | DefiOrderPayload> {
  const blockNumber = event.blockNumber.toString()
  const timestamp = event.timestamp ?? Date.now()

  const baseOrderDetails: DefiOrderPayload = {
    type: 'order',
    networkId: CHAIN_ID,
    orderId: event.orderId,
    owner: event.who,
    protocol: 'dca',
    status: event.status,
    blockNumber,
    timestamp,
  }

  if (event.type === 'dca.completed') {
    return of(baseOrderDetails)
  }

  const routeAssets =
    event.type === 'dca.executed'
      ? event.route.flatMap((r) => [r.assetIn.toString(), r.assetOut.toString()])
      : []

  return resolveAssets(
    [...new Set([event.assetIn.toString(), event.assetOut.toString(), ...routeAssets])],
    fetchAssetMetadata,
  ).pipe(
    mergeMap((assets) => {
      if (event.type === 'dca.executed') {
        const ctx = {
          who: event.who,
          blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash ?? 'intrinsic',
        }

        const route = event.route
          .map((r) => toSwapEventPayload(r, ctx, assets, computeUsdValue))
          .filter((s) => s !== null)

        const order = mapSwapToOrderPayload(event, assets, computeUsdValue)

        return order ? [order, ...route] : route
      }
      const assetInMeta = assets.get(event.assetIn)
      const assetOutMeta = assets.get(event.assetOut)

      if (!assetInMeta || !assetOutMeta) {
        return []
      }
      return [
        {
          ...baseOrderDetails,
          creation: {
            assetIn: toAssetId(CHAIN_ID, event.assetIn),
            assetOut: toAssetId(CHAIN_ID, event.assetOut),
            symbolIn: assetInMeta.symbol ?? '??',
            symbolOut: assetOutMeta.symbol ?? '??',
            createdAtBlock: blockNumber,
            createdAt: timestamp,
            blockHash: event.blockHash,
            txHash: event.extrinsic?.txHash,
            amountIn: event.amountIn ? formatUnits(event.amountIn, assetInMeta.decimals ?? 0) : undefined,
            amountOut: event.amountOut ? formatUnits(event.amountOut, assetOutMeta.decimals ?? 0) : undefined,
          },
        },
      ]
    }),
  )
}

function mapLending(
  event: HydrationLendingEvent,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
): Observable<DefiEventPayload> {
  const assetId = event.asset.toString()
  const actor = event.who.toLowerCase()

  return forkJoin({
    assets: resolveAssets([assetId], fetchAssetMetadata),
    accounts: resolveAccounts([actor], fetchAccounts),
  }).pipe(
    map(({ assets, accounts }) => {
      const assetMeta = assets.get(event.asset)
      if (!assetMeta) {
        return null
      }
      const normalizedAmount = formatUnits(event.amount, assetMeta.decimals ?? 0)

      return {
        ...basePayload({
          protocol: toProtocol(event.protocol),
          blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash ?? null,
          marketId: event.marketId,
        }),
        name: event.action as MoneyMarketActions,
        data: {
          provider: accounts.get(actor)!,
          assets: [
            {
              amount: normalizedAmount,
              assetId: toAssetId(CHAIN_ID, assetId),
              symbol: assetMeta.symbol ?? '??',
              amountUSD: computeUsdValue(event.asset, Number(normalizedAmount)),
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
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
): Observable<DefiEventPayload> {
  const debtId = event.debtAsset.toString()
  const colId = event.collateralAsset.toString()
  const name = 'liquidate' as const
  const liquidator = event.who.toLowerCase()
  const liquidated = event.counterparty.toLowerCase()

  return forkJoin({
    assets: resolveAssets([debtId, colId], fetchAssetMetadata),
    accounts: resolveAccounts([liquidator, liquidated], fetchAccounts),
  }).pipe(
    map(({ assets, accounts }) => {
      const debt = assets.get(event.debtAsset)
      const collateral = assets.get(event.collateralAsset)
      if (!debt || !collateral) {
        return null
      }
      const normalizedDebtAmount = formatUnits(event.debtCovered, debt.decimals ?? 0)
      const normalizedCollateralAmount = formatUnits(event.collateralLiquidated, collateral.decimals ?? 0)

      return {
        ...basePayload({
          protocol: toProtocol(event.protocol),
          blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash,
          txHash: event.extrinsic?.txHash ?? null,
          marketId: event.marketId,
        }),
        name,
        data: {
          origin: accounts.get(liquidator)!,
          counterparty: accounts.get(liquidated)!,
          debt: {
            amount: normalizedDebtAmount,
            assetId: toAssetId(CHAIN_ID, debtId),
            symbol: debt.symbol ?? '??',
            amountUSD: computeUsdValue(event.debtAsset, Number(normalizedDebtAmount)),
          },
          collateral: {
            amount: normalizedCollateralAmount,
            assetId: toAssetId(CHAIN_ID, colId),
            symbol: collateral.symbol ?? '??',
            amountUSD: computeUsdValue(event.collateralAsset, Number(normalizedCollateralAmount)),
          },
        },
      }
    }),
    filter((ev) => ev !== null),
  )
}

function mapSwapped3(
  event: HydrationSwapped3Event,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
) {
  return resolveAssets(
    [...new Set([event.assetIn.toString(), event.assetOut.toString()])],
    fetchAssetMetadata,
  ).pipe(
    map((assets) => {
      const ctx = {
        who: event.who,
        blockNumber: event.blockNumber.toString(),
        blockHash: event.blockHash,
        txHash: event.extrinsic?.txHash ?? 'intrinsic',
      }

      return toSwapEventPayload(event, ctx, assets, computeUsdValue)
    }),
    filter((e) => e !== null),
  )
}

function mapSwaps(
  event: HydrationSwapEvent,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
) {
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
      }

      const route = event.route
        .map((r) => toSwapEventPayload(r, ctx, assets, computeUsdValue))
        .filter((s) => s !== null)

      const order = mapSwapToOrderPayload(event, assets, computeUsdValue)

      return order ? [order, ...route] : route
    }),
  )
}

export function watchEvents(
  logger: Logger,
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>,
  fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>,
  computeUsdValue: (assetId: number, amount: number) => number | undefined,
) {
  return (source$: Observable<Block>): Observable<DefiEventPayload | DefiOrderPayload> =>
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
            isApplyExtrinsic,
          ] as [BlockEvent, EventRecordWithIndex<Event>[], boolean]
        })
      }),
      map(([event, siblings]) => {
        const key = toHandlerKey(event)
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
        switch (event.type) {
          case 'swapped3':
            return mapSwapped3(event, fetchAssetMetadata, computeUsdValue)
          case 'swap':
            return mapSwaps(event, fetchAssetMetadata, computeUsdValue)
          case 'lending':
            return mapLending(event, fetchAssetMetadata, fetchAccounts, computeUsdValue)
          case 'liquidation':
            return mapLiquidation(event, fetchAssetMetadata, fetchAccounts, computeUsdValue)
          case 'dca.executed':
          case 'dca.scheduled':
          case 'dca.completed':
            return mapDca(event, fetchAssetMetadata, computeUsdValue)

          default:
            return EMPTY
        }
      }),
    )
}

import { BlockEvent, BlockEvmEvent, Event, EventRecord } from '@/services/networking/substrate/types.js'
import { MoneyMarketActions } from '../../../types.js'
import { Enum } from 'polkadot-api'

export type EventHandler = (event: BlockEvent, siblings: EventRecordWithIndex[]) => HydrationDefiEvent | null
export type EvmEventHandler = (
  event: BlockEvmEvent,
  siblings: EventRecordWithIndex[],
) => HydrationDefiEvent | null

export type EventRecordWithIndex = EventRecord<Event> & { index: number }

export interface BaseHydrationDefiEvent {
  blockNumber: number
  blockHash: string
  who: string
  event: {
    blockPosition: number
    module: string
    name: string
  }
  timestamp?: number
  extrinsic?: {
    txHash: string
    evmTxHash?: string
    module: string
    method: string
  }
}

export type FillerType = Enum<{
  Omnipool: undefined
  Stableswap: number
  XYK: number
  LBP: undefined
  OTC: number
  Aave: undefined
}>

export type FillerTypeName = Lowercase<
  FillerType['type']
>

export interface SwapRoute {
  marketId: string
  assetIn: number
  amountIn: bigint
  assetOut: number
  amountOut: bigint
  protocol: FillerTypeName | 'router'
}

export interface HydrationSwapEvent extends SwapRoute, BaseHydrationDefiEvent {
  type: 'swap'
  route: SwapRoute[]
}

export interface HydrationLendingEvent extends BaseHydrationDefiEvent {
  type: 'lending'
  action: MoneyMarketActions | 'liquidate'
  protocol: 'aave',
  marketId: string
  asset: number
  amount: bigint
}

export type HydrationDefiEvent = HydrationSwapEvent | HydrationLendingEvent

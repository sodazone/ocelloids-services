import { BlockEvent, BlockEvmEvent, Event, EventRecord } from '@/services/networking/substrate/types.js'
import { MoneyMarketActions } from '../../../types.js'

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

export interface SwapRoute {
  marketId: string
  assetIn: number
  amountIn: bigint
  assetOut: number
  amountOut: bigint
}

export interface HydrationSwapEvent extends SwapRoute, BaseHydrationDefiEvent {
  type: 'swap'
  route: SwapRoute[]
}

export interface HydrationLendingEvent extends BaseHydrationDefiEvent {
  type: 'lending'
  action: MoneyMarketActions | 'liquidate'
  marketId: string
  asset: number
  amount: bigint
}

export type HydrationDefiEvent = HydrationSwapEvent | HydrationLendingEvent

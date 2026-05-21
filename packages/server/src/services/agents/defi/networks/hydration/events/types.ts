import { BlockEvent, Event, EventRecord } from '@/services/networking/substrate/types.js'

export type EventHandler = (event: BlockEvent, siblings: EventRecordWithIndex[]) => HydrationDefiEvent

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

export type HydrationDefiEvent = HydrationSwapEvent

import { Enum, FixedSizeArray, FixedSizeBinary } from 'polkadot-api'
import {
  BlockEvent,
  BlockEvmEvent,
  Event,
  EventRecordWithIndex,
} from '@/services/networking/substrate/types.js'
import { MoneyMarketActions } from '../../../types.js'

export type EventHandler = (
  event: BlockEvent,
  siblings: EventRecordWithIndex<Event>[],
) => HydrationDefiEvent | null
export type EvmEventHandler = (
  event: BlockEvmEvent,
  siblings: EventRecordWithIndex<Event>[],
) => HydrationDefiEvent | null

export type BroadcastSwapped = {
  swapper: string
  filler: string
  filler_type: FillerType
  fees: {
    asset: number
    amount: bigint
    destination: Enum<{
      Account: string
      Burned: undefined
    }>
  }[]
  inputs: {
    asset: number
    amount: bigint
  }[]
  outputs: {
    asset: number
    amount: bigint
  }[]
  operation: Enum<{
    ExactIn: undefined
    ExactOut: undefined
    Limit: undefined
    LiquidityAdd: undefined
    LiquidityRemove: undefined
  }>
  operation_stack: Enum<{
    Router: number
    DCA: FixedSizeArray<2, number>
    Batch: number
    Omnipool: number
    XcmExchange: number
    Xcm: [FixedSizeBinary<32>, number]
  }>[]
}

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

export type FillerTypeName = Lowercase<FillerType['type']>

export interface SwapRoute {
  marketId: string
  assetIn: number
  amountIn: bigint
  assetOut: number
  amountOut: bigint
  protocol: FillerTypeName | 'router'
}

export interface HydrationSwapped3Event extends SwapRoute, BaseHydrationDefiEvent {
  type: 'swapped3'
}

export interface HydrationSwapEvent extends SwapRoute, BaseHydrationDefiEvent {
  type: 'swap'
  orderId: string
  status: 'filled'
  route: SwapRoute[]
}

export interface HydrationDcaExecutedEvent extends BaseHydrationDefiEvent {
  type: 'dca.executed'
  orderId: string
  status: 'partially_filled'
  assetIn: number
  amountIn: bigint
  assetOut: number
  amountOut: bigint
  route: SwapRoute[]
}

export interface HydrationDcaScheduledEvent extends BaseHydrationDefiEvent {
  type: 'dca.scheduled'
  orderId: string
  status: 'placed'
  assetIn: number
  amountIn?: bigint
  assetOut: number
  amountOut?: bigint
}

export interface HydrationDcaCompletedEvent extends BaseHydrationDefiEvent {
  type: 'dca.completed'
  orderId: string
  status: 'filled'
}

export interface HydrationLendingEvent extends BaseHydrationDefiEvent {
  type: 'lending'
  action: MoneyMarketActions
  protocol: 'aave'
  marketId: string
  asset: number
  amount: bigint
}

export interface HydrationLiquidationEvent extends BaseHydrationDefiEvent {
  type: 'liquidation'
  protocol: 'aave'
  marketId: string
  debtAsset: number
  debtCovered: bigint
  collateralAsset: number
  collateralLiquidated: bigint
  counterparty: string
}

export type HydrationDcaEvent =
  | HydrationDcaScheduledEvent
  | HydrationDcaExecutedEvent
  | HydrationDcaCompletedEvent

export type HydrationDefiEvent =
  | HydrationSwapped3Event
  | HydrationSwapEvent
  | HydrationLendingEvent
  | HydrationLiquidationEvent
  | HydrationDcaEvent

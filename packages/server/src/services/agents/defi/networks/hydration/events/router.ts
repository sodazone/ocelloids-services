import { Enum, FixedSizeArray, FixedSizeBinary } from 'polkadot-api'
import { matchEvent } from '@/services/agents/xcm/ops/util.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { ROUTER_ADDRESS } from '../consts.js'
import { EventRecordWithIndex, HydrationSwapEvent, SwapRoute } from './types.js'
import { asPublicKey } from '@/common/util.js'

type RouterExecutedEvent = {
  asset_in: number
  asset_out: number
  amount_in: bigint
  amount_out: bigint
  event_id: number
}

export type FillerType = Enum<{
  Omnipool: undefined
  Stableswap: number
  XYK: number
  LBP: undefined
  OTC: number
  Aave: undefined
}>

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

export function routerExecutedHandler(
  event: BlockEvent,
  siblings: EventRecordWithIndex[],
): HydrationSwapEvent {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, value, timestamp } = event

  if (!extrinsic) {
    throw new Error('No extrinsic in router executed event')
  }
  const { amount_in, amount_out, asset_in, asset_out } = value as RouterExecutedEvent
  const { address, hash: txHash, evmTxHash, module: txModule, method } = extrinsic
  const swappedEvents = siblings
    .filter((e) => matchEvent(e.event, 'Broadcast', 'Swapped3'))
    .map((e) => e.event.value as BroadcastSwapped)

  const route: SwapRoute[] = swappedEvents.map(({ inputs, outputs, filler }) => {
    const assetIn = inputs[0].asset
    const assetOut = outputs[0].asset
    const amountIn = inputs[0].amount
    const amountOut = outputs[0].amount
    return {
      marketId: asPublicKey(filler),
      assetIn,
      amountIn,
      assetOut,
      amountOut,
    }
  })

  return {
    type: 'swap',
    timestamp,
    blockNumber,
    blockHash,
    event: {
      blockPosition,
      module,
      name,
    },
    extrinsic: {
      txHash,
      evmTxHash,
      module: txModule,
      method,
    },
    who: asPublicKey(address),
    marketId: ROUTER_ADDRESS,
    assetIn: asset_in,
    amountIn: amount_in,
    assetOut: asset_out,
    amountOut: amount_out,
    route,
  }
}

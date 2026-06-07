import { asPublicKey } from '@/common/util.js'
import { matchEvent } from '@/services/agents/xcm/ops/util.js'
import { BlockEvent, EventRecordWithIndex, Event } from '@/services/networking/substrate/types.js'
import { ROUTER_ADDRESS } from '../consts.js'
import {
  BroadcastSwapped,
  FillerTypeName,
  HydrationSwapEvent,
  SwapRoute,
} from './types.js'

type RouterExecutedEvent = {
  asset_in: number
  asset_out: number
  amount_in: bigint
  amount_out: bigint
  event_id: number
}

export function routerExecutedHandler(
  event: BlockEvent,
  siblings: EventRecordWithIndex<Event>[],
): HydrationSwapEvent {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, value, timestamp } = event

  if (!extrinsic) {
    throw new Error('No extrinsic in router executed event')
  }
  const { amount_in, amount_out, asset_in, asset_out, event_id } = value as RouterExecutedEvent
  const { address, hash: txHash, evmTxHash, module: txModule, method } = extrinsic

  let swapperAddress = address

  const swappedEvents = siblings
    .filter((e) => matchEvent(e.event, 'Broadcast', 'Swapped3'))
    .map((e) => e.event.value as BroadcastSwapped)

  const route: SwapRoute[] = swappedEvents.map(
    ({ inputs, outputs, filler, filler_type, swapper }): SwapRoute => {
      const assetIn = inputs[0].asset
      const assetOut = outputs[0].asset
      const amountIn = inputs[0].amount
      const amountOut = outputs[0].amount
      const protocol = filler_type.type.toLowerCase() as FillerTypeName

      if (!swapperAddress) {
        swapperAddress = swapper
      }

      return {
        marketId: asPublicKey(filler),
        protocol,
        assetIn,
        amountIn,
        assetOut,
        amountOut,
      }
    },
  )

  return {
    type: 'swap',
    protocol: 'router',
    orderId: `router-${event_id}`,
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
    status: 'filled',
    who: asPublicKey(swapperAddress),
    marketId: ROUTER_ADDRESS,
    assetIn: asset_in,
    amountIn: amount_in,
    assetOut: asset_out,
    amountOut: amount_out,
    route,
  }
}

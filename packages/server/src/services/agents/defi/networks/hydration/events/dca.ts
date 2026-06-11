import { Enum } from 'polkadot-api'
import { asPublicKey } from '@/common/util.js'
import { matchEvent } from '@/services/agents/xcm/ops/util.js'
import { BlockEvent, Event, EventRecordWithIndex } from '@/services/networking/substrate/types.js'
import {
  BroadcastSwapped,
  FillerType,
  FillerTypeName,
  HydrationDcaCompletedEvent,
  HydrationDcaExecutedEvent,
  HydrationDcaScheduledEvent,
  SwapRoute,
} from './types.js'

type DcaCompletedEvent = {
  id: number
  who: string
}

type DcaExecutedEvent = {
  id: number
  who: string
  amount_in: bigint
  amount_out: bigint
}

type DcaOrder = Enum<{
  Sell: {
    asset_in: number
    asset_out: number
    amount_in: bigint
    min_amount_out: bigint
    route: {
      pool: FillerType
      asset_in: number
      asset_out: number
    }[]
  }
  Buy: {
    asset_in: number
    asset_out: number
    amount_out: bigint
    max_amount_in: bigint
    route: {
      pool: FillerType
      asset_in: number
      asset_out: number
    }[]
  }
}>

type DcaScheduledEvent = {
  id: number
  who: string
  period: number
  total_amount: bigint
  order: DcaOrder
}

export function dcaExecutedHandler(
  event: BlockEvent,
  siblings: EventRecordWithIndex<Event>[],
): HydrationDcaExecutedEvent {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, value, timestamp } = event
  const { id, amount_in, amount_out, who } = value as DcaExecutedEvent

  const txCtx = extrinsic
    ? {
        txHash: extrinsic.hash,
        evmTxHash: extrinsic.evmTxHash,
        module: extrinsic.module,
        method: extrinsic.method,
      }
    : undefined

  const swappedEvents = siblings
    .filter((e) => matchEvent(e.event, 'Broadcast', 'Swapped3'))
    .map((e) => e.event.value as BroadcastSwapped)

  const route: SwapRoute[] = swappedEvents.map(({ inputs, outputs, filler, filler_type }): SwapRoute => {
    const assetIn = inputs[0].asset
    const assetOut = outputs[0].asset
    const amountIn = inputs[0].amount
    const amountOut = outputs[0].amount
    const protocol = filler_type.type.toLowerCase() as FillerTypeName

    return {
      marketId: asPublicKey(filler),
      protocol,
      assetIn,
      amountIn,
      assetOut,
      amountOut,
    }
  })

  const assetIn = route[0].assetIn
  const assetOut = route[route.length - 1].assetOut

  return {
    type: 'dca.executed',
    orderId: `dca-${id}`,
    status: 'partially_filled',
    timestamp,
    blockNumber,
    blockHash,
    event: {
      blockPosition,
      module,
      name,
    },
    extrinsic: txCtx,
    who: asPublicKey(who),
    assetIn,
    assetOut,
    amountIn: amount_in,
    amountOut: amount_out,
    route,
  }
}

export function dcaScheduledHandler(
  event: BlockEvent,
  _siblings: EventRecordWithIndex<Event>[],
): HydrationDcaScheduledEvent {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, value, timestamp } = event
  const { id, who, total_amount, order } = value as DcaScheduledEvent

  const txCtx = extrinsic
    ? {
        txHash: extrinsic.hash,
        evmTxHash: extrinsic.evmTxHash,
        module: extrinsic.module,
        method: extrinsic.method,
      }
    : undefined

  const isBuy = order.type === 'Buy'
  const amountIn = isBuy ? 0n : total_amount
  const amountOut = isBuy ? total_amount : 0n

  return {
    type: 'dca.scheduled',
    orderId: `dca-${id}`,
    status: 'placed',
    timestamp,
    blockNumber,
    blockHash,
    event: {
      blockPosition,
      module,
      name,
    },
    extrinsic: txCtx,
    who: asPublicKey(who),
    assetIn: order.value.asset_in,
    assetOut: order.value.asset_out,
    amountIn,
    amountOut,
  }
}

export function dcaCompletedHandler(
  event: BlockEvent,
  _siblings: EventRecordWithIndex<Event>[],
): HydrationDcaCompletedEvent {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, value, timestamp } = event
  const { id, who } = value as DcaCompletedEvent

  const txCtx = extrinsic
    ? {
        txHash: extrinsic.hash,
        evmTxHash: extrinsic.evmTxHash,
        module: extrinsic.module,
        method: extrinsic.method,
      }
    : undefined

  return {
    type: 'dca.completed',
    orderId: `dca-${id}`,
    status: 'filled',
    who: asPublicKey(who),
    timestamp,
    blockNumber,
    blockHash,
    event: {
      blockPosition,
      module,
      name,
    },
    extrinsic: txCtx,
  }
}

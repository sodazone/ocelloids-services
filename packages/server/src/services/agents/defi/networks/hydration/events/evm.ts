import { Abi, decodeEventLog, Log, toEventSelector } from 'viem'
import {
  BlockEvent,
  BlockEvmEvent,
  Event,
  EventRecordWithIndex,
} from '@/services/networking/substrate/types.js'
import aavePoolAbi from '../abi/aave_pool.json' with { type: 'json' }
import {
  aaveBorrowHandler,
  aaveLiquidationHandler,
  aaveRepayHandler,
  aaveSupplyHandler,
  aaveWithdrawHandler,
} from './aave.js'
import { EvmEventHandler, HydrationDefiEvent } from './types.js'

const eventSelectorRegistry = new Map(
  (aavePoolAbi as Abi)
    .filter((item) => item.type === 'event')
    .map((ev) => [toEventSelector(ev), { abi: [ev], protocol: 'aave' }]),
)

const evmLogHandlers: Record<string, EvmEventHandler> = {
  'aave.borrow': aaveBorrowHandler,
  'aave.supply': aaveSupplyHandler,
  'aave.withdraw': aaveWithdrawHandler,
  'aave.repay': aaveRepayHandler,
  'aave.liquidationcall': aaveLiquidationHandler,
}

function decodeLog(event: BlockEvent): [string, BlockEvmEvent] | null {
  const { address, topics, data } = event.value.log as Log
  const topic0 = topics[0]
  if (typeof topic0 === 'undefined' || data === '0x' || !topic0) {
    return null
  }

  const entry = eventSelectorRegistry.get(topic0)
  if (!entry) {
    return null
  }

  try {
    const decoded = decodeEventLog({
      abi: entry.abi,
      data,
      topics,
    })

    return [
      entry.protocol,
      {
        ...event,
        address,
        topics,
        data,
        decoded,
      } as BlockEvmEvent,
    ]
  } catch (_e) {
    return null
  }
}

function toHandlerKey(protocol: string, evmEvent: BlockEvmEvent) {
  const name = evmEvent.decoded?.eventName
  return name ? `${protocol}.${name.toLowerCase()}` : protocol
}

export function evmLogHandler(
  event: BlockEvent,
  siblings: EventRecordWithIndex<Event>[],
): HydrationDefiEvent | null {
  const decoded = decodeLog(event)
  if (decoded === null) {
    return null
  }
  const [protocol, blockEvmEvent] = decoded
  const handler = evmLogHandlers[toHandlerKey(protocol, blockEvmEvent)]
  if (!handler) {
    return null
  }
  return handler(blockEvmEvent, siblings)
}

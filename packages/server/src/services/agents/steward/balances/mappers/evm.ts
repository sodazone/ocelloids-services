import { decodeEventLog, Log, toEventSelector } from 'viem'
import { BlockEvent, BlockEvmEvent } from '@/services/networking/substrate/types.js'

const transferEventDefs = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'index',
        type: 'uint256',
      },
    ],
    name: 'BalanceTransfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
] as const

const topicToEvent = Object.fromEntries(transferEventDefs.map((ev) => [toEventSelector(ev), ev]))

export function decodeLog(event: BlockEvent) {
  const { address, topics, data } = event.value.log as Log
  const topic0 = topics[0]
  if (typeof topic0 === 'undefined' || data === '0x') {
    return null
  }
  const ev = topicToEvent[topic0]
  if (!ev) {
    return null
  }

  try {
    const decoded = decodeEventLog({
      abi: [ev],
      data,
      topics,
    })
    return {
      ...event,
      address,
      topics,
      data,
      decoded,
    } as BlockEvmEvent
  } catch (e) {
    console.error(
      e,
      `Error decoding EVM event log block=${event.blockHash} event=${event.blockNumber}-${event.blockPosition} data=${data}`,
    )
    return null
  }
}

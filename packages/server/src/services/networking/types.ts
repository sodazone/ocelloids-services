import { type SystemEvent } from '@polkadot-api/observable-client'
import { type Decoder } from '@polkadot-api/substrate-bindings'

export type StorageCodec<T = any> = {
  enc: (...args: any[]) => string
  dec: Decoder<T>
  keyDecoder: (value: string) => any[]
}

export type Event = {
  module: string
  name: string
  value: Record<string, any>
}

export type EventRecord<T = Event> = Omit<SystemEvent, 'event'> & {
  event: T
}

export type Extrinsic = {
  hash: string
  module: string
  method: string
  signed: boolean
  signature: any
  address: any
  args: Record<string, any>
}

export type Block = {
  hash: string
  number: number
  parent: string
  extrinsics: Extrinsic[]
  events: EventRecord[]
}

export type BlockContext = {
  blockNumber: number
  blockHash: string
  blockPosition: number
  timestamp?: number
}

export type BlockExtrinsic = Extrinsic & BlockContext

export type BlockEvent = Event &
  BlockContext & {
    extrinsic?: BlockExtrinsic
    extrinsicPosition?: number
  }

export type BlockEvmEvent = BlockEvent & {
  address: string
  topics: [string]
  data?: string
  decoded?: {
    eventName: string
    args?: any
  }
}

export type BlockExtrinsicWithEvents = BlockExtrinsic & {
  events: BlockEvent[]
  dispatchInfo: any
  dispatchError: any
}

export type BlockEvmTransaction = BlockExtrinsicWithEvents & {
  executed?: {
    from: string
    to: string
    transaction_hash: string
    exit_reason: { type: string; value: { type: string } }
    extra_data: string
  }
  to: string
  from: string
  value: bigint
  logs?: {
    eventName: string
    args: any[]
  }[]
  decoded?: {
    functionName: string
    args: any
  }
}

export type Hashers = (
  | {
      tag: 'Blake2128'
      value: undefined
    }
  | {
      tag: 'Blake2256'
      value: undefined
    }
  | {
      tag: 'Blake2128Concat'
      value: undefined
    }
  | {
      tag: 'Twox128'
      value: undefined
    }
  | {
      tag: 'Twox256'
      value: undefined
    }
  | {
      tag: 'Twox64Concat'
      value: undefined
    }
  | {
      tag: 'Identity'
      value: undefined
    }
)[]

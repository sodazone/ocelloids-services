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

export type BlockExtrinsicWithEvents = BlockExtrinsic & {
  events: BlockEvent[]
  dispatchInfo: any
  dispatchError: any
}

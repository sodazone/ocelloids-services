import { HexString } from '@/lib.js'
import { NetworkURN } from '@/services/types.js'

export type SubstrateIsmpRequestEvent = {
  dest_chain: {
    type: string
    value: number
  }
  source_chain: {
    type: string
    value: number
  }
  request_nonce: bigint
  commitment: HexString
}

export type SubstrateIsmpPostRequest = {
  source: string // "POLKADOT-2030"
  dest: string // "EVM-8453"
  nonce: number
  from: HexString
  to: HexString
  timeoutTimestamp: number
  body: HexString
}

export type SubstrateIsmpQueryRequest = {
  Post: SubstrateIsmpPostRequest
}

export type HyperbridgePostRequest = {
  source: NetworkURN
  destination: NetworkURN
  nonce: string
  commitment: HexString
  from: HexString
  to: HexString
  timeout: number
  body: HexString
}

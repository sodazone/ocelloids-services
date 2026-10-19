import { JsonRpcProvider } from 'near-api-js'

export type ProviderInstance = InstanceType<typeof JsonRpcProvider>
export type NearBlockHeader = Awaited<ReturnType<ProviderInstance['viewBlock']>>
export type ChunkHeaderView = NearBlockHeader['chunks'][number]
export type NearChunk = ChunkHeaderView & Awaited<ReturnType<ProviderInstance['viewChunk']>>
export type NearTxStatus = Awaited<ReturnType<ProviderInstance['viewTransactionStatus']>>
export type NearBlockTransaction = NearChunk['transactions'][number]
export type NearBlock = NearBlockHeader & {
  transactions: NearBlockTransaction[]
  timestamp: number
  number: number
  hash: string
  parentHash: string
  ingestionMode?: string
}

export type NearNetworkInfo = {
  chainId: string
  rpcUrl: string
  networkId?: string
  latestBlockHeight?: number
  syncing?: boolean
  protocolVersion?: string
  nodeSoftwareVersion?: string
}

export type NearTransaction = NearBlockTransaction & {
  blockNumber: number
  blockHash: string
  timestamp: number
}

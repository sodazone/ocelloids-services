export type XcmTransfer = {
  id: number
  correlationId: string
  sentAt: number
  recvAt: number
  asset: string
  symbol: string
  decimals: number
  amount: bigint
  origin: string
  destination: string
  originProtocol: string
  destinationProtocol: string
  from: string
  to: string
  volume?: number
}

export type NewXcmTransfer = Omit<XcmTransfer, 'id'>

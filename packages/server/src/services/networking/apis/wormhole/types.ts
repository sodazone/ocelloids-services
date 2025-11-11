// Wormhole Portal Token Bridge Types
export interface TransferPayload {
  payloadType: 1
  amount: string
  tokenAddress: string
  toAddress: string
  toChain: number
  fromAddress: string
}

export interface NFTTransferPayload {
  payloadType: 2
  tokenId: string
  uri: string
  toAddress: string
  toChain: number
  fromAddress: string
}

export interface TransferWithPayload {
  payloadType: 3
  amount: string
  callerAppId: string
  fee: string
  fromAddress: string
  parsedPayload: string | null
  payload: string
  toAddress: string
  toChain: number
  tokenAddress: string
  tokenChain: number
}

export type PayloadPortalTokenBridge = TransferPayload | NFTTransferPayload | TransferWithPayload

// Fallback Types
export type PayloadUnknown = {
  payloadType: number
  raw: Record<string, unknown>
}

export type Payload = PayloadPortalTokenBridge | PayloadUnknown

export type WormholeOpStatus = 'in_progress' | 'completed' | 'confirmed'

export interface WormholeOperation<P = Payload> {
  id: string
  emitterChain: number
  emitterAddress: {
    hex: string
    native: string
  }
  sequence: string
  vaa: {
    guardianSetIndex: number
    isDuplicated: boolean
    raw: string
  }
  content: {
    payload: P
    standarizedProperties: {
      amount: string
      appIds: string[]
      fee: string
      feeAddress: string
      feeChain: number
      fromAddress: string
      fromChain: number
      normalizedDecimals: number | null
      toAddress: string
      toChain: number
      tokenAddress: string
      tokenChain: number
      wrappedTokenAddress?: string
      wrappedTokenSymbol?: string
    }
  }
  sourceChain: {
    attribute: {
      type: string
      value: Record<string, string>
    }
    chainId: number
    fee: string
    feeUSD: string
    from: string
    gasTokenNotional: string
    timestamp: string
    transaction: {
      secondTxHash: string
      txHash: string
    }
    status: WormholeOpStatus
  }
  targetChain: {
    balanceChanges: {
      amount: string
      recipient: string
      tokenAddress: string
    }[]
    chainId: number
    fee: string
    feeUSD: string
    from: string
    gasTokenNotional: string
    timestamp: string
    to: string
    transaction: {
      secondTxHash: string
      txHash: string
    }
    status: WormholeOpStatus
  }
  data: Record<string, string>
  isBigTransaction: boolean
  isDailyLimitExceeded: boolean
  transactionLimit: number
}

export const WormholeProtocols = ['wh', 'wh_portal', 'wh_relayer'] as const
export type WormholeProtocol = (typeof WormholeProtocols)[number]
export type WormholeAction = 'transfer' | 'transact' | '??'

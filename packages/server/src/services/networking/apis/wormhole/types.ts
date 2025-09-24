// Wormhole Portal Token Bridge Types
export interface TransferPayload {
  payloadType: 1
  amount: string
  tokenAddress: string
  toAddress: string
  toChain: number
}

export interface NFTTransferPayload {
  payloadType: 2
  tokenId: string
  uri: string
  toAddress: string
  toChain: number
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
    raw: number[]
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
      normalizedDecimals: number
      toAddress: string
      toChain: number
      tokenAddress: string
      tokenChain: number
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
    status: string
    timestamp: string
    transaction: {
      secondTxHash: string
      txHash: string
    }
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
    status: string
    timestamp: string
    to: string
    transaction: {
      secondTxHash: string
      txHash: string
    }
  }
  data: Record<string, string>
}

// Narrows WormholeOperation's payload if appIds contains PORTAL_TOKEN_BRIDGE
export type PortalTokenBridgeOperation = Omit<WormholeOperation, 'content'> & {
  content: Omit<WormholeOperation['content'], 'payload'> & {
    payload: PayloadPortalTokenBridge
  }
}

export function isPortalTokenBridge(op: WormholeOperation): op is PortalTokenBridgeOperation {
  return op.content.standarizedProperties.appIds.includes('PORTAL_TOKEN_BRIDGE')
}

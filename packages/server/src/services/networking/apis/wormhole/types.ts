export interface WormholeOperation<P> {
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

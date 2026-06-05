import { FixedSizeBinary } from 'polkadot-api'

export type TokenId = { type: string; value: number | { type: string; value: any } }

export type LstMarketBase = {
  type: string
  underlying: {
    id: TokenId
    sourceId?: string
    symbol?: string
    decimals: number
  }
  lst: {
    id: TokenId
    symbol?: string
    decimals: number
  }
  delegators: Set<string>
  stakingNetwork: string
}

export type StakingProtocol =
  | {
      type: 'GeneralXCMStaking'
      value: [TokenId, number]
    }
  | {
      type: 'GeneralProxyStaking'
      value: [TokenId, number]
    }
  | {
      type: 'EthereumStaking'
    }

export type StakingDelegator =
  | {
      type: 'Substrate'
      value: string
    }
  | {
      type: 'Ethereum'
      value: FixedSizeBinary<20>
    }

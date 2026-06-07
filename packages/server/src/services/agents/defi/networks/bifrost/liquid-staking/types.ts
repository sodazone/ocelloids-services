import { Enum, FixedSizeBinary } from 'polkadot-api'

export type TokenId = { type: string; value: number | { type: string; value: any } }

export type LstMarketBase = {
  type: string
  underlying: {
    id: string
    sourceId?: string
    symbol?: string
    decimals: number
  }
  lst: {
    id: string
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

export type VtokenMintedEvent = {
  currency_id: TokenId
  minter: string
  currency_amount: bigint
  v_currency_amount: bigint
  mint_fee: bigint
  remark: string
  channel_id: number | undefined
}

export type VtokenRedeemedEvent = {
  currency_id: TokenId
  redeemer: string
  unlock_id: number
  to: Enum<{
    Native: string
    Astar: string
    Moonbeam: FixedSizeBinary<20>
    Hydradx: string
    Interlay: string
    Manta: string
    HyperBridge: [number, FixedSizeBinary<20>]
    AssetHub: string
  }>
  currency_amount: bigint
}

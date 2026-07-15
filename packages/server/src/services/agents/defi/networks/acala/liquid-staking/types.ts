export type HomaStakingLedgerUnlocking = {
  value: bigint
  era: number
}

export type HomaStakingLedgerValue = {
  bonded: bigint
  unlocking: HomaStakingLedgerUnlocking[]
}

export type HomaMintedEvent = {
  minter: string
  staking_currency_amount: bigint
  liquid_amount_received: bigint
  liquid_amount_added_to_void: bigint
}

export type HomaRedeemedByFastMatchEvent = {
  redeemer: string
  matched_liquid_amount: bigint
  fee_in_liquid: bigint
  redeemed_staking_amount: bigint
}

export type HomaRedeemedByUnbondEvent = {
  redeemer: string
  era_index_when_unbond: number
  liquid_amount: bigint
  unbonding_staking_amount: bigint
}

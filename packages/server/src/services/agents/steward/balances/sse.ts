import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { createServerSideEventsBroadcaster } from '../../api/sse.js'
import { ServerSideEvent } from '../../types.js'
import { AssetId, StewardServerSideEventArgs } from '../types.js'

export type BalanceEventName = 'balance' | 'status' | 'synced'

export type AccountData = {
  accountId: string
  publicKey: HexString
}

export type StatusData = AccountData & {
  status: string
}

export type AssetData = {
  chainId: NetworkURN
  assetId: AssetId
  symbol?: string
  decimals?: number
}

export type BalancesData = AccountData &
  AssetData & {
    origin: 'snapshot' | 'update'
    balance: bigint
  }

export type SyncedEvent = {
  event: 'synced'
  data: AccountData
}

export type StatusEvent = {
  event: 'status'
  data: StatusData
}

export type BalanceEvent = {
  event: 'balance'
  data: BalancesData
}

export type BalanceEvents = BalanceEvent | StatusEvent | SyncedEvent

function applySseFilters(
  { account }: StewardServerSideEventArgs,
  { data }: ServerSideEvent<BalanceEvent> | ServerSideEvent<SyncedEvent> | ServerSideEvent<StatusEvent>,
): boolean {
  const pubKeyFilter = Array.isArray(account) ? account.map((a) => asPublicKey(a)) : [asPublicKey(account)]
  if (!pubKeyFilter.includes(data.publicKey)) {
    return false
  }
  return true
}

export const createStewardBroadcaster = () =>
  createServerSideEventsBroadcaster<StewardServerSideEventArgs, BalanceEvents>(applySseFilters)

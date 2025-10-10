import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { createServerSentEventsBroadcaster } from '../../api/sse.js'
import { ServerSentEvent } from '../../types.js'
import { AssetId, StewardServerSentEventArgs } from '../types.js'

/**
 * Data Steward server-sent event names.
 *
 * @public
 */
export type BalanceEventName = 'balance' | 'status' | 'synced'

/**
 * Data Steward server-sent event account event.
 *
 * @public
 */
export type AccountData = {
  accountId: string
  publicKey: HexString
}

/**
 * Data Steward server-sent event status data.
 *
 * @public
 */
export type StatusData = AccountData & {
  status: string
}

/**
 * Data Steward server-sent event assets data.
 *
 * @public
 */
export type AssetData = {
  chainId: NetworkURN
  assetId: AssetId
  symbol?: string
  decimals?: number
}

/**
 * Data Steward server-sent event balances data.
 *
 * @public
 */
export type BalancesData = AccountData &
  AssetData & {
    origin: 'snapshot' | 'update'
    balance: bigint
  }

/**
 * Data Steward server-sent event for balance synced event.
 *
 * @public
 */
export type SyncedEvent = {
  event: 'synced'
  data: AccountData
}

/**
 * Data Steward server-sent event for balance discovery status.
 *
 * @public
 */
export type StatusEvent = {
  event: 'status'
  data: StatusData
}

/**
 * Data Steward server-sent event for balance snapshot.
 *
 * @public
 */
export type BalanceEvent = {
  event: 'balance'
  data: BalancesData
}

/**
 * Data Steward server-sent balances event.
 *
 * @public
 */
export type BalanceEvents = BalanceEvent | StatusEvent | SyncedEvent

function applySseFilters(
  { account }: StewardServerSentEventArgs,
  { data }: ServerSentEvent<BalanceEvent> | ServerSentEvent<SyncedEvent> | ServerSentEvent<StatusEvent>,
): boolean {
  const pubKeyFilter = Array.isArray(account) ? account.map((a) => asPublicKey(a)) : [asPublicKey(account)]
  if (!pubKeyFilter.includes(data.publicKey)) {
    return false
  }
  return true
}

export const createStewardBroadcaster = () =>
  createServerSentEventsBroadcaster<StewardServerSentEventArgs, BalanceEvents>(applySseFilters)

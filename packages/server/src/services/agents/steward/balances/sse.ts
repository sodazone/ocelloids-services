import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { createServerSideEventsBroadcaster } from '../../api/sse.js'
import { ServerSideEvent } from '../../types.js'
import { AssetId, StewardServerSideEventArgs } from '../types.js'

export type AccountData = {
  account: string
  publicKey: HexString
}
export type BalancesData = AccountData &
  {
    chainId: NetworkURN
    assetId: AssetId
    assetMetadata: {
      symbol?: string
      decimals?: number
    }
    balance: bigint
  }[]

function applySseFilters(
  { account }: StewardServerSideEventArgs,
  { data }: ServerSideEvent<BalancesData> | ServerSideEvent<AccountData>,
): boolean {
  const pubKeyFilter = Array.isArray(account) ? account.map((a) => asPublicKey(a)) : [asPublicKey(account)]
  if (!pubKeyFilter.includes(data.publicKey)) {
    return false
  }
  return true
}

export const createStewardBroadcaster = () =>
  createServerSideEventsBroadcaster<StewardServerSideEventArgs>(applySseFilters)

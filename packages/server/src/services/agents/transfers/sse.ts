import { asPublicKey } from '@/common/util.js'
import { createServerSentEventsBroadcaster } from '../api/sse.js'
import { ServerSentEvent } from '../types.js'
import { IcTransferResponse } from './repositories/types.js'
import { TransfersFilters } from './types.js'

type TransferEvents = {
  event: string
  data: IcTransferResponse
}

function applySseFilters(filters: TransfersFilters, { data }: ServerSentEvent<TransferEvents>) {
  if (filters.txHash && filters.txHash !== data.txPrimary && filters.txHash !== data.txSecondary) {
    return false
  }
  if (filters.address) {
    const pubKeyOrEvmAddress = asPublicKey(filters.address)

    const matchFrom =
      data.network === 'urn:ocn:polkadot:2034'
        ? data.from?.slice(0, 42) === pubKeyOrEvmAddress.slice(0, 42)
        : data.from === pubKeyOrEvmAddress

    const matchTo =
      data.network === 'urn:ocn:polkadot:2034'
        ? data.to?.slice(0, 42) === pubKeyOrEvmAddress.slice(0, 42)
        : data.to === pubKeyOrEvmAddress

    if (!matchFrom && !matchTo) {
      return false
    }
  }
  if (filters.networks && !filters.networks.includes(data.network)) {
    return false
  }
  if (filters.usdAmountGte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountGte as unknown as string)
      if (!data.usd || data.usd < parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.usdAmountLte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountLte as unknown as string)
      if (!data.usd || data.usd > parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.assets) {
    const filterAssets = Array.isArray(filters.assets) ? filters.assets.map((a) => a.toLowerCase()) : []

    const hasAsset = filterAssets.some((a) => data.asset === a)
    if (!hasAsset) {
      return false
    }
  }
  if (filters.types && !filters.types.includes(data.type)) {
    return false
  }

  return true
}

export const createTransfersBroadcaster = () =>
  createServerSentEventsBroadcaster<TransfersFilters>(applySseFilters)

import { asPublicKey } from '@/common/util.js'

import { createServerSentEventsBroadcaster } from '../api/sse.js'
import { ServerSentEvent } from '../types.js'
import { FullJourneyResponse } from './repositories/types.js'
import { XcServerSentEventArgs } from './types/sse.js'

type XcEvents = {
  event: string
  data: FullJourneyResponse
}

function applySseFilters(
  filters: XcServerSentEventArgs,
  { data: journey }: ServerSentEvent<XcEvents>,
): boolean {
  if (filters.id && filters.id !== journey.correlationId) {
    return false
  }
  if (
    filters.txHash &&
    filters.txHash !== journey.originTxPrimary &&
    filters.txHash !== journey.originTxSecondary
  ) {
    return false
  }
  if (filters.address) {
    const pubKeyOrEvmAddress = asPublicKey(filters.address)

    const matchFrom =
      journey.origin === 'urn:ocn:polkadot:2034'
        ? journey.from?.slice(0, 42) === pubKeyOrEvmAddress.slice(0, 42)
        : journey.from === pubKeyOrEvmAddress

    const matchTo =
      journey.destination === 'urn:ocn:polkadot:2034'
        ? journey.to?.slice(0, 42) === pubKeyOrEvmAddress.slice(0, 42)
        : journey.to === pubKeyOrEvmAddress

    if (!matchFrom && !matchTo) {
      return false
    }
  }
  if (
    filters.protocols &&
    !filters.protocols.includes(journey.originProtocol as any) &&
    !filters.protocols.includes(journey.destinationProtocol as any)
  ) {
    return false
  }
  if (filters.origins && !filters.origins.includes(journey.origin)) {
    return false
  }
  if (filters.destinations && !filters.destinations.includes(journey.destination)) {
    return false
  }
  if (
    filters.networks &&
    !filters.networks.includes(journey.origin) &&
    !filters.networks.includes(journey.destination)
  ) {
    return false
  }
  if (filters.usdAmountGte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountGte as unknown as string)
      if (journey.totalUsd < parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.usdAmountLte !== undefined) {
    try {
      const parsedAmount = parseInt(filters.usdAmountLte as unknown as string)
      if (journey.totalUsd > parsedAmount) {
        return false
      }
    } catch {
      //
    }
  }
  if (filters.assets) {
    const assetsInJourney = journey.assets.map((a) => a.asset.toLowerCase())
    const filterAssets = Array.isArray(filters.assets)
      ? filters.assets.map((a) => a.toLowerCase())
      : [filters.assets.toLowerCase()]

    const hasAsset = filterAssets.some((a) => assetsInJourney.includes(a))
    if (!hasAsset) {
      return false
    }
  }
  if (filters.actions && !filters.actions.includes(journey.type)) {
    return false
  }
  if (filters.status !== undefined) {
    const toCheck = Array.isArray(filters.status) ? filters.status : [filters.status]
    if (!toCheck.map((s) => s as typeof journey.status).includes(journey.status)) {
      return false
    }
  }

  return true
}

export const createCrosschainBroadcaster = () =>
  createServerSentEventsBroadcaster<XcServerSentEventArgs>(applySseFilters)

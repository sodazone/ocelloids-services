import { asSerializable } from '@/common/util.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'
import { networks } from '@/services/agents/common/networks.js'
import { XcmJunction, XcmLocation } from '@/services/networking/substrate/types.js'

export const CHAIN_ID = networks.assetHub
export const PROTOCOL = 'asset-conversion'
export const MAX_BATCH_SIZE = 50
export const DOT_DECIMALS = 10
export const USDT_DECIMALS = 6
export const PRICE_EMISSION_THRESHOLD = 0.0001
export const WHITELISTED_LOCAL_ASSETS = ['1984', '1337']

export const BASE_TOKEN_LOCATION = {
  parents: 1,
  interior: {
    type: 'Here',
  },
}

type LocalAssetLocation = {
  parents: 0
  interior: {
    type: 'X2'
    value: XcmJunction[]
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export function isBaseToken(loc: XcmLocation) {
  return loc.parents === 1 && loc.interior.type === 'Here'
}

export function isLocalAsset(loc: XcmLocation): loc is LocalAssetLocation {
  return loc.parents === 0 && loc.interior.type === 'X2'
}

export function getLocalAssetId(loc: LocalAssetLocation) {
  const assetIdJunction = loc.interior.value.find((j) => j.type === 'GeneralIndex')

  if (assetIdJunction) {
    return assetIdJunction.value as bigint
  }
}

export function locationToIdString(location: XcmLocation): string {
  return normalizeAssetId(asSerializable(location))
}

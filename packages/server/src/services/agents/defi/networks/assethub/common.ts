import { networks } from '@/services/agents/common/networks.js'

export const CHAIN_ID = networks.assetHub
export const PROTOCOL = 'asset-conversion'
export const MAX_BATCH_SIZE = 50
export const DOT_DECIMALS = 10
export const USDT_DECIMALS = 6
export const PRICE_EMISSION_THRESHOLD = 0.0001

export const WHITELISTED_LOCAL_ASSETS = [1984, 1337]

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

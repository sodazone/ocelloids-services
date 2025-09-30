import { NetworkURN } from '@/lib.js'
import { normalizeAssetId } from '@/services/agents/common/melbourne.js'

export const WormholeIds = {
  MOONBEAM_ID: 16,
  SOLANA_ID: 1,
  ETHEREUM_ID: 2,
  BASE_ID: 30,
  BNB_ID: 4,
  POLYGON_ID: 5,
  SUI_ID: 21,
  OP_ID: 24,
  ARB_ID: 23,
}
const WormholeChainIds: Record<NetworkURN, number> = {
  'urn:ocn:solana:1': WormholeIds.SOLANA_ID,
  'urn:ocn:polkadot:1284': WormholeIds.MOONBEAM_ID,
  'urn:ocn:ethereum:56': WormholeIds.BNB_ID,
  'urn:ocn:ethereum:137': WormholeIds.POLYGON_ID,
  'urn:ocn:ethereum:1': WormholeIds.ETHEREUM_ID,
  'urn:ocn:ethereum:10': WormholeIds.OP_ID,
  'urn:ocn:ethereum:42161': WormholeIds.ARB_ID,
  'urn:ocn:ethereum:8453': WormholeIds.BASE_ID,
  'urn:ocn:sui:1': WormholeIds.SUI_ID,
} as const

export const WormholeChainUrns: Record<number, keyof typeof WormholeChainIds> = Object.fromEntries(
  Object.entries(WormholeChainIds).map(([urn, id]) => [id, urn]),
) as any

export function urnToChainId(chainUrn: NetworkURN): number | undefined {
  return WormholeChainIds[chainUrn]
}

export function chainIdToUrn(chainId: number): string {
  const urn = WormholeChainUrns[chainId]
  return urn === undefined ? `urn:ocn:unknown:${chainId}` : urn
}

export function tokenAddressToAssetId(chainId: number, tokenAddress: string | 'native') {
  return `${chainIdToUrn(chainId)}|${tokenAddress === 'native' ? tokenAddress : normalizeAssetId(tokenAddress)}`
}

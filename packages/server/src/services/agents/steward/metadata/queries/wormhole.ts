import { LevelDB, NetworkURN } from '@/services/types.js'
import { QueryResult } from '../../../types.js'
import { AssetMetadata, WormholeNetwork } from '../../types.js'
import { assetMetadataKey } from '../../util.js'

export const WormholeChainNameToId = {
  Solana: 1,
  Ethereum: 2,
  Bsc: 4,
  Polygon: 5,
  Avalanche: 6,
  Algorand: 8,
  Klaytn: 13,
  Celo: 14,
  Near: 15,
  Moonbeam: 16,
  Injective: 19,
  Osmosis: 20,
  Sui: 21,
  Aptos: 22,
  Arbitrum: 23,
  Optimism: 24,
  Pythnet: 26,
  Btc: 29,
  Base: 30,
  Sei: 32,
  Linea: 38,
  Berachain: 39,
  Seievm: 40,
  Unichain: 44,
  Worldchain: 45,
  Ink: 46,
  HyperEVM: 47,
  Monad: 48,
  Mezo: 50,
  Fogo: 51,
  Sonic: 52,
  Converge: 53,
  Plume: 55,
  XRPLEVM: 57,
  Plasma: 58,
  CreditCoin: 59,
  Stacks: 60,
  Moca: 63,
  MegaETH: 64,
  Xrpl: 66,
  ZeroGravity: 67,
  Tempo: 68,
  Nexus: 69,
  Arc: 71,
  Robinhood: 72,
  Hydration: 73,
  Wormchain: 3104,
  Cosmoshub: 4000,
  Evmos: 4001,
  Kujira: 4002,
  Neutron: 4003,
  Celestia: 4004,
  Stargaze: 4005,
  Seda: 4006,
  Dymension: 4007,
  Provenance: 4008,
  Noble: 4009,
  Sepolia: 10002,
  ArbitrumSepolia: 10003,
  BaseSepolia: 10004,
  OptimismSepolia: 10005,
  Holesky: 10006,
  PolygonSepolia: 10007,
  MonadTestnet: 10009,
  HyperCore: 65000,
} as const

export const WormholeIds = {
  MOONBEAM_ID: 16,
  SOLANA_ID: 1,
  ETHEREUM_ID: 2,
  BASE_ID: 30,
  BSC_ID: 4,
  POLYGON_ID: 5,
  SUI_ID: 21,
  OP_ID: 24,
  ARB_ID: 23,
  CELO_ID: 14,
  AVAX_ID: 6, // C-chain
  APTOS_ID: 22,
  TEMPO_ID: 68,
  NEXUS_ID: 69,
  ARC_ID: 71,
  ROBINHOOD_ID: 72,
  HYDRATION_ID: 73,
  WORMCHAIN_ID: 3104,
  COSMOSHUB_ID: 4000,
  NEAR_ID: 15,
  HYPEREVM_ID: 47,
}

export const WormholeSupportedNetworks = Object.values(WormholeIds)

export const WormholeChainIds: Record<NetworkURN, number> = {
  'urn:ocn:solana:101': WormholeIds.SOLANA_ID,
  'urn:ocn:polkadot:2004': WormholeIds.MOONBEAM_ID,
  'urn:ocn:polkadot:2034': WormholeIds.HYDRATION_ID,
  'urn:ocn:ethereum:56': WormholeIds.BSC_ID,
  'urn:ocn:ethereum:137': WormholeIds.POLYGON_ID,
  'urn:ocn:ethereum:1': WormholeIds.ETHEREUM_ID,
  'urn:ocn:ethereum:10': WormholeIds.OP_ID,
  'urn:ocn:ethereum:42161': WormholeIds.ARB_ID,
  'urn:ocn:ethereum:8453': WormholeIds.BASE_ID,
  'urn:ocn:ethereum:42220': WormholeIds.CELO_ID,
  'urn:ocn:ethereum:43114': WormholeIds.AVAX_ID,
  'urn:ocn:ethereum:4663': WormholeIds.ROBINHOOD_ID,
  'urn:ocn:ethereum:999': WormholeIds.HYPEREVM_ID,
  'urn:ocn:sui:0x35834a8a': WormholeIds.SUI_ID,
  'urn:ocn:aptos:1': WormholeIds.APTOS_ID,
  'urn:ocn:near:397': WormholeIds.NEAR_ID,
} as const

const WormholeChainUrns: Record<number, keyof typeof WormholeChainIds> = Object.fromEntries(
  Object.entries(WormholeChainIds).map(([urn, id]) => [id, urn]),
) as any

export function chainIdToUrn(chainId: number): NetworkURN {
  const urn = WormholeChainUrns[chainId]
  return urn === undefined ? `urn:ocn:unknown:${chainId}` : urn
}

export function urnToChainId(chainUrn: NetworkURN): number | undefined {
  return WormholeChainIds[chainUrn]
}

export function chainNameToChainId(chainName: keyof typeof WormholeChainNameToId): number | undefined {
  return WormholeChainNameToId[chainName]
}

export class WormholeQueryHandler {
  readonly #dbAssets: LevelDB

  constructor(dbAssets: LevelDB) {
    this.#dbAssets = dbAssets
  }

  queryWormholeIds(criteria: { ids: number[] }): QueryResult<WormholeNetwork> {
    return {
      items: criteria.ids.map((chainId) => ({ wormholeId: chainId, urn: chainIdToUrn(chainId) })),
    }
  }

  async queryAsset(
    criteria: { assets: string[]; wormholeId: number }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const keys = criteria.flatMap((s) => {
      const urn = chainIdToUrn(s.wormholeId)
      return s.assets.map((a) => assetMetadataKey(urn, a))
    })
    const items = (
      await this.#dbAssets.getMany<string, AssetMetadata>(keys, {
        /** */
      })
    ).filter((x) => x !== undefined)
    return {
      items,
    }
  }
}

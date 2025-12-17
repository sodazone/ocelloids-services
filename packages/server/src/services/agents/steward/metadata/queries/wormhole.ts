import { LevelDB, NetworkURN } from '@/services/types.js'
import { QueryResult } from '../../../types.js'
import { AssetMetadata } from '../../types.js'
import { assetMetadataKey } from '../../util.js'

type WormholeNetwork = { wormholeId: number; urn: NetworkURN }

const WormholeIds = {
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
}

const WormholeChainIds: Record<NetworkURN, number> = {
  'urn:ocn:solana:101': WormholeIds.SOLANA_ID,
  'urn:ocn:polkadot:2004': WormholeIds.MOONBEAM_ID,
  'urn:ocn:ethereum:56': WormholeIds.BSC_ID,
  'urn:ocn:ethereum:137': WormholeIds.POLYGON_ID,
  'urn:ocn:ethereum:1': WormholeIds.ETHEREUM_ID,
  'urn:ocn:ethereum:10': WormholeIds.OP_ID,
  'urn:ocn:ethereum:42161': WormholeIds.ARB_ID,
  'urn:ocn:ethereum:8453': WormholeIds.BASE_ID,
  'urn:ocn:ethereum:42220': WormholeIds.CELO_ID,
  'urn:ocn:ethereum:43114': WormholeIds.AVAX_ID,
  'urn:ocn:sui:0x35834a8a': WormholeIds.SUI_ID,
  'urn:ocn:aptos:1': WormholeIds.APTOS_ID,
} as const

const WormholeChainUrns: Record<number, keyof typeof WormholeChainIds> = Object.fromEntries(
  Object.entries(WormholeChainIds).map(([urn, id]) => [id, urn]),
) as any

function chainIdToUrn(chainId: number): NetworkURN {
  const urn = WormholeChainUrns[chainId]
  return urn === undefined ? `urn:ocn:unknown:${chainId}` : urn
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

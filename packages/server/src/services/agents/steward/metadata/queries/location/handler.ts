import { firstValueFrom } from 'rxjs'

import { NetworkURN, QueryResult } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { LevelDB } from '@/services/types.js'

import { AssetMetadata, Empty } from '../../../types.js'
import { assetMetadataKey } from '../../../util.js'
import { mappers } from '../../mappers.js'
import { parseAssetFromJson } from './util.js'

export class LocationQueryHandler {
  readonly #db: LevelDB
  readonly #ingress: SubstrateIngressConsumer

  constructor(db: LevelDB, ingress: SubstrateIngressConsumer) {
    this.#db = db
    this.#ingress = ingress
  }

  // TODO: temporary support for fetching asset metadata from multilocation
  // will be refactored, probably as part of the XCM Humanizer agent
  async queryAssetByLocation(
    criteria: { xcmLocationAnchor: string; locations: string[] }[],
  ): Promise<QueryResult<AssetMetadata | Empty>> {
    const queries = criteria.flatMap(({ xcmLocationAnchor, locations }) =>
      locations.map((location) => ({ xcmLocationAnchor, location })),
    )
    const results = await Promise.allSettled(
      queries.map(({ xcmLocationAnchor, location }) =>
        this.resolveAssetIdFromLocation(xcmLocationAnchor, location),
      ),
    )
    const keys = results.map((result, i) =>
      result.status === 'fulfilled' ? (result.value ?? queries[i].location) : queries[i].location,
    )

    const assets = await this.#db.getMany<string, AssetMetadata>(keys, {
      /** */
    })

    return {
      items: assets.map((a, i) =>
        a !== undefined
          ? a
          : {
              isNotResolved: true,
              query: queries[i],
            },
      ),
    }
  }

  async resolveAssetIdFromLocation(xcmLocationAnchor: string, loc: string): Promise<string | undefined> {
    const parsed = parseAssetFromJson(xcmLocationAnchor as NetworkURN, loc)
    if (parsed) {
      const { network, assetId } = parsed
      if (assetId.type === 'string' || assetId.type === 'contract') {
        return assetMetadataKey(network, assetId.value)
      } else if (assetId.type === 'data') {
        const mappings = mappers[network](await this.#getApiContext(network))
        const { mapAssetId } = mappings[0]
        if (mapAssetId) {
          const kk = mapAssetId(assetId.value)
          if (kk) {
            return assetMetadataKey(network, kk[0])
          }
        }
      }
    }
  }

  async #getApiContext(chainId: NetworkURN) {
    return firstValueFrom(this.#ingress.getContext(chainId))
  }
}

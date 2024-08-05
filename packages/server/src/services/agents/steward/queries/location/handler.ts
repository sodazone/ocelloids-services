import { firstValueFrom } from 'rxjs'

import { Registry } from '@polkadot/types-codec/types'
import { u8aConcat } from '@polkadot/util'

import { NetworkURN } from '@/lib.js'
import { getRelayId } from '@/services/config.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { LevelDB } from '@/services/types.js'

import { QueryResult } from '../../../types.js'
import { mappers } from '../../mappers.js'
import { AssetIdData, AssetMetadata } from '../../types.js'
import { assetMetadataKey } from '../../util.js'
import { parseAssetFromJson } from './util.js'

export class LocationQueryHandler {
  readonly #db: LevelDB
  readonly #ingress: IngressConsumer

  constructor(db: LevelDB, ingress: IngressConsumer) {
    this.#db = db
    this.#ingress = ingress
  }

  // TODO: temporary support for fetching asset metadata from multilocation
  // will be refactored, probably as part of the XCM Humanizer agent
  async queryAssetByLocation(
    criteria: { xcmLocationAnchor: string; locations: string[] }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const keys: string[] = []
    for (const { xcmLocationAnchor, locations } of criteria) {
      const relayRegistry = await this.#getRegistry(getRelayId(xcmLocationAnchor as NetworkURN))

      for (const loc of locations) {
        try {
          const parsed = parseAssetFromJson(xcmLocationAnchor as NetworkURN, loc, relayRegistry)

          if (parsed) {
            const { network, assetId, pallet } = parsed
            if (assetId.type === 'string') {
              keys.push(assetMetadataKey(network, assetId.value))
            } else {
              const registry = await this.#getRegistry(network)
              let mappings = mappers[network].mappings
              if (pallet) {
                mappings = mappings.filter((m) => m.palletInstance === pallet)
              }
              for (const mapping of mappings) {
                const id = mapping.resolveAssetId
                  ? mapping.resolveAssetId(registry, assetId.value)
                  : this.#resolveAssetId(registry, mapping.assetIdType, assetId.value)
                keys.push(assetMetadataKey(network, id))
              }
            }
          } else {
            keys.push(loc)
          }
        } catch {
          keys.push(loc)
        }
      }
    }

    return {
      items: await this.#db.getMany<string, AssetMetadata>(keys, {
        /** */
      }),
    }
  }

  #resolveAssetId(registry: Registry, assetIdType: string, assetIdData: AssetIdData[]) {
    let fullKey = new Uint8Array()
    for (const aidData of assetIdData) {
      const keyValue = aidData.data.slice(0, aidData.length)
      fullKey = u8aConcat(fullKey, keyValue)
    }
    try {
      return registry.createType(assetIdType, fullKey).toString()
    } catch (_error) {
      return 'none'
    }
  }

  async #getRegistry(network: NetworkURN) {
    return firstValueFrom(this.#ingress.getRegistry(network))
  }
}

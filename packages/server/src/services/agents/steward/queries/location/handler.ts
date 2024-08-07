import { firstValueFrom } from 'rxjs'

import { Registry } from '@polkadot/types-codec/types'
import { u8aConcat } from '@polkadot/util'

import { NetworkURN } from '@/lib.js'
import { getRelayId } from '@/services/config.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { LevelDB } from '@/services/types.js'

import { QueryResult } from '../../../types.js'
import { mappers } from '../../mappers.js'
import { AssetIdData, AssetMapping, AssetMetadata } from '../../types.js'
import { assetMetadataKey } from '../../util.js'
import { parseAssetFromJson } from './util.js'

export class LocationQueryHandler {
  readonly #db: LevelDB
  readonly #ingress: IngressConsumer

  constructor(db: LevelDB, ingress: IngressConsumer) {
    this.#db = db
    this.#ingress = ingress
  }

  async queryAssetByLocation(
    criteria: { xcmLocationAnchor: string; locations: string[] }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const ids: string[] = []
    for (const { xcmLocationAnchor, locations } of criteria) {
      const relayRegistry = await this.#getRegistry(getRelayId(xcmLocationAnchor as NetworkURN))

      for (const loc of locations) {
        try {
          const resolved = await this.resolveAssetIdsFromLocation(xcmLocationAnchor, loc, relayRegistry)
          ids.push(resolved ?? loc)
        } catch (_error) {
          ids.push(loc)
        }
      }
    }

    return {
      items: await this.#db.getMany<string, AssetMetadata>(ids, {
        /** */
      }),
    }
  }

  async resolveAssetIdsFromLocation(
    xcmLocationAnchor: string,
    loc: string,
    registry?: Registry,
  ): Promise<string | undefined> {
    const reg = registry ?? (await this.#getRegistry(getRelayId(xcmLocationAnchor as NetworkURN)))

    const parsed = parseAssetFromJson(xcmLocationAnchor as NetworkURN, loc, reg)

    if (parsed) {
      const { network, assetId, pallet } = parsed
      if (assetId.type === 'string') {
        return assetMetadataKey(network, assetId.value)
      } else {
        const reserveChainRegistry = await this.#getRegistry(network)
        let mapping: AssetMapping | undefined
        if (pallet) {
          mapping = mappers[network].mappings.find((m) => m.palletInstance === pallet)
        } else {
          mapping = mappers[network].mappings[0]
        }
        if (mapping) {
          const id = mapping.resolveAssetId
            ? mapping.resolveAssetId(reserveChainRegistry, assetId.value)
            : this.#resolveAssetId(reserveChainRegistry, mapping.assetIdType, assetId.value)
          return assetMetadataKey(network, id)
        }
      }
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

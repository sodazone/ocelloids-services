import { Registry } from '@polkadot/types-codec/types'
import { hexToU8a, u8aConcat, u8aToU8a } from '@polkadot/util'
import { blake2AsU8a, xxhashAsU8a } from '@polkadot/util-crypto'

import { Observable, map, mergeMap } from 'rxjs'

import { HexString } from '../../../lib.js'
import { IngressConsumer } from '../../ingress/index.js'
import { NetworkURN } from '../../types.js'
import { AssetMapper, AssetMetadata, GeneralKey, networks } from './types.js'

const OFFSET_128 = 16 * 2
const OFFSET_64 = 8 * 2

type Hashing = 'xx-64' | 'blake2-128'

const BYPASS_MAPPER: AssetMapper = {
  mappings: [],
}

function keyValue(registry: Registry, type: string, keyArgs: string, hashing: Hashing) {
  return registry.createType(
    type,
    hexToU8a('0x' + keyArgs.substring(hashing === 'xx-64' ? OFFSET_64 : OFFSET_128)),
  )
}

const keyConcat = (data: string | Buffer | Uint8Array, hashing: Hashing) => {
  return hashing === 'xx-64' ? xx64concat(data) : blake2128concat(data)
}

const blake2128concat = (data: string | Buffer | Uint8Array) =>
  u8aConcat(blake2AsU8a(data, 128), u8aToU8a(data))

const xx64concat = (data: string | Buffer | Uint8Array) => u8aConcat(xxhashAsU8a(data, 64), u8aToU8a(data))

const mapAssetsAndLocations = ({
  chainId,
  assetIdType,
  assetMetadataType,
  multiLocationKeyType,
  multiLocationKeyPrefix,
  multiLocationDataType,
  hashing,
  onMultiLocationData,
}: {
  chainId: string
  assetIdType: string
  assetMetadataType: string
  multiLocationKeyType: string
  multiLocationKeyPrefix: HexString
  multiLocationDataType: string
  hashing: Hashing
  onMultiLocationData?: (json: Record<string, any>) => Record<string, any>
}) => {
  return (registry: Registry, keyArgs: string, ingress: IngressConsumer) => {
    return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
      return source.pipe(
        map((buffer) => {
          const assetId = keyValue(registry, assetIdType, keyArgs, hashing).toString()
          const assetDetails =
            (registry.createType(assetMetadataType, buffer).toHuman() as Record<string, any>) ?? {}

          return {
            id: assetId,
            updated: Date.now(),
            name: assetDetails.name,
            symbol: assetDetails.symbol,
            decimals: assetDetails.decimals,
            chainId,
            raw: {
              ...assetDetails,
              keyArgs,
            },
          } as AssetMetadata
        }),
        mergeMap((asset) => {
          // Expand multilocations
          const key = (multiLocationKeyPrefix +
            Buffer.from(
              keyConcat(
                keyValue(registry, multiLocationKeyType, asset.raw.keyArgs, hashing).toU8a(),
                hashing,
              ),
            ).toString('hex')) as HexString
          return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
            map((buffer) => {
              const maybeLoc = registry.createType(multiLocationDataType, buffer)
              if (maybeLoc.toHex() !== '0x0000') {
                const multiLocation =
                  onMultiLocationData === undefined
                    ? maybeLoc.toJSON()
                    : onMultiLocationData(maybeLoc.toJSON() as Record<string, any>)
                return {
                  ...asset,
                  multiLocation,
                } as AssetMetadata
              } else {
                return asset
              }
            }),
          )
        }),
      )
    }
  }
}

const moonbeamMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 104,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.moonbeam,
        assetIdType: 'u128',
        assetMetadataType: 'PalletAssetsAssetMetadata',
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db10031e932ed06f88c7a37d7c7c3f5fbeca1c',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MoonbeamRuntimeXcmConfigAssetType',
        hashing: 'blake2-128',
        onMultiLocationData: (json: Record<string, any>) => json.xcm,
      }),
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('u128', keyValue).toString()
      },
    },
  ],
}

const bifrostMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 114,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6259988d804f8bb04d82c701e7f01fb9764',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.bifrost,
        assetIdType: 'BifrostPrimitivesCurrencyCurrencyId',
        assetMetadataType: 'BifrostAssetRegistryAssetMetadata',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6255f54cd54ea84dd94c101101f587e088d',
        multiLocationKeyType: 'BifrostPrimitivesCurrencyCurrencyId',
        multiLocationDataType: 'StagingXcmV3MultiLocation',
        hashing: 'xx-64',
      }),
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('BifrostPrimitivesCurrencyCurrencyId', keyValue).toString()
      },
    },
  ],
}

const hydrationMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 51,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625682a59d51ab9e48a8c8cc418ff9708d2',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.hydration,
        assetIdType: 'u32',
        assetMetadataType: 'PalletAssetRegistryAssetDetails',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6252dc0b8ee4c66b0b3e24b03ec002e2544',
        multiLocationKeyType: 'u32',
        multiLocationDataType: 'HydradxRuntimeXcmAssetLocation',
        hashing: 'blake2-128',
      }),
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('u32', keyValue).toString()
      },
    },
  ],
}

const mantaMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 46,
      keyPrefix: '0x4ae7e256f92e5888372d72f3e4db1003b20b1df17c1eb8537e32dc07a9bfe191',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.manta,
        assetIdType: 'u128',
        assetMetadataType: 'MantaPrimitivesAssetsAssetRegistryMetadata',
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db1003f4f3777447099e92d2a7274f5bbd71a6',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MantaPrimitivesAssetsAssetLocation',
        hashing: 'blake2-128',
      }),
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('u128', keyValue).toString()
      },
    },
  ],
}

const assetHubMapper: AssetMapper = {
  mappings: [
    {
      // assets pallet
      palletInstance: 50,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: (registry: Registry, keyArgs: string, _ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(registry, 'u32', keyArgs, 'blake2-128').toString()
              const assetDetails =
                (registry.createType('AssetMetadata', buffer).toHuman() as Record<string, any>) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: networks.assethub,
                raw: assetDetails,
              } as AssetMetadata
            }),
          )
        }
      },
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('u32', keyValue).toString()
      },
    },
    {
      // Foreign assets pallet
      palletInstance: 53,
      keyPrefix: '0x30e64a56026f4b5e3c2d196283a9a17db5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: (registry: Registry, keyArgs: string) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const multiLocation = keyValue(registry, 'StagingXcmV3MultiLocation', keyArgs, 'blake2-128')
              const assetId = multiLocation.toString()
              const assetDetails =
                (registry.createType('AssetMetadata', buffer).toHuman() as Record<string, any>) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: networks.assethub,
                multiLocation: multiLocation.toJSON(),
                raw: assetDetails,
              } as AssetMetadata
            }),
          )
        }
      },
      mapKey: (registry: Registry, key: GeneralKey) => {
        const keyValue = key.data.toU8a().slice(0, key.length.toNumber())
        return registry.createType('StagingXcmV3MultiLocation', keyValue).toString()
      },
    },
  ],
}

export const mappers: Record<string, AssetMapper> = {
  [networks.polkadot]: BYPASS_MAPPER,
  [networks.assethub]: assetHubMapper,
  [networks.bifrost]: bifrostMapper,
  [networks.hydration]: hydrationMapper,
  [networks.moonbeam]: moonbeamMapper,
  [networks.manta]: mantaMapper,
}

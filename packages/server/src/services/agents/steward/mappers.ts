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

function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location.toJSON === undefined ? location : location.toJSON()
  }
  return undefined
}

const mapAssets = ({
  chainId,
  assetMetadataType,
  hashing,
}: {
  chainId: string
  assetMetadataType: string
  hashing: Hashing
}) => {
  return (registry: Registry, keyArgs: string, assetIdType: string) => {
    return (source: Observable<Uint8Array>): Observable<NonNullable<AssetMetadata>> => {
      return source.pipe(
        map((buffer) => {
          const assetId = keyValue(registry, assetIdType, keyArgs, hashing).toString()
          const assetDetails =
            (registry.createType(assetMetadataType, buffer).toHuman() as Record<string, any>) ?? {}
          return {
            chainId,
            id: assetId,
            updated: Date.now(),
            name: assetDetails.name,
            symbol: assetDetails.symbol,
            decimals: assetDetails.decimals,
            multiLocation: getLocationIfAny(assetDetails),
            raw: {
              ...assetDetails,
              keyArgs,
            },
          } as NonNullable<AssetMetadata>
        }),
      )
    }
  }
}

const mapAssetsAndLocations = ({
  chainId,
  assetMetadataType,
  metadataHashing,
  multiLocationHashing = metadataHashing,
  multiLocationKeyType,
  multiLocationKeyPrefix,
  multiLocationDataType,
  onMultiLocationData,
}: {
  chainId: string
  assetMetadataType: string
  metadataHashing: Hashing
  multiLocationHashing?: Hashing
  multiLocationKeyType: string
  multiLocationKeyPrefix: HexString
  multiLocationDataType: string
  onMultiLocationData?: (json: Record<string, any>) => Record<string, any>
}) => {
  return (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
    return (source: Observable<Uint8Array>): Observable<NonNullable<AssetMetadata>> => {
      return source.pipe(
        mapAssets({ chainId, assetMetadataType, hashing: metadataHashing })(registry, keyArgs, assetIdType),
        mergeMap((asset) => {
          // Expand multilocations
          const key = (multiLocationKeyPrefix +
            Buffer.from(
              keyConcat(
                keyValue(registry, multiLocationKeyType, asset.raw.keyArgs, multiLocationHashing).toU8a(),
                multiLocationHashing,
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
                } as NonNullable<AssetMetadata>
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

const astarMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 36,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'u128',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.astar,
        assetMetadataType: 'PalletAssetsAssetMetadata',
        metadataHashing: 'blake2-128',
        multiLocationKeyPrefix: '0x9f5ad049cfbc7f413497855ef0232d4ea6718f60b6df3f6a17994cdf85e14dd4',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'XcmVersionedMultiLocation',
        multiLocationHashing: 'xx-64',
      }),
    },
  ],
}

const moonbeamMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 104,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'u128',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.moonbeam,
        metadataHashing: 'blake2-128',
        assetMetadataType: 'PalletAssetsAssetMetadata',
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db10031e932ed06f88c7a37d7c7c3f5fbeca1c',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MoonbeamRuntimeXcmConfigAssetType',
        onMultiLocationData: (json: Record<string, any>) => json.xcm,
      }),
    },
  ],
}

const centrifugeMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 152,
      keyPrefix: '0xd28431b6793b590766d3a73137018ccab5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'CfgTypesTokensCurrencyId',
      mapEntry: mapAssets({
        chainId: networks.centrifuge,
        assetMetadataType: 'OrmlTraitsAssetRegistryAssetMetadata',
        hashing: 'xx-64',
      }),
    },
  ],
}

const interlayMapper: AssetMapper = {
  nativeKeyBySymbol: true,
  mappings: [
    {
      palletInstance: 24,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625b5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'u32',
      resolveKey: (registry, keyValue) => {
        const v = registry.createType('InterbtcPrimitivesCurrencyId', keyValue) as unknown as any
        if (v.isToken) {
          return `native#${v.asToken.toString()}`
        }
        if (v.isForeignAsset) {
          return v.asForeignAsset.toString()
        }
        return 'none'
      },
      mapEntry: mapAssets({
        chainId: networks.interlay,
        assetMetadataType: 'OrmlTraitsAssetRegistryAssetMetadata',
        hashing: 'xx-64',
      }),
    },
  ],
}

const bifrostMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 114,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6259988d804f8bb04d82c701e7f01fb9764',
      assetIdType: 'BifrostPrimitivesCurrencyCurrencyId',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.bifrost,
        assetMetadataType: 'BifrostAssetRegistryAssetMetadata',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6255f54cd54ea84dd94c101101f587e088d',
        multiLocationKeyType: 'BifrostPrimitivesCurrencyCurrencyId',
        multiLocationDataType: 'StagingXcmV3MultiLocation',
        metadataHashing: 'xx-64',
      }),
    },
  ],
}

const hydrationMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 51,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625682a59d51ab9e48a8c8cc418ff9708d2',
      assetIdType: 'u32',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.hydration,
        assetMetadataType: 'PalletAssetRegistryAssetDetails',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6252dc0b8ee4c66b0b3e24b03ec002e2544',
        multiLocationKeyType: 'u32',
        multiLocationDataType: 'HydradxRuntimeXcmAssetLocation',
        metadataHashing: 'blake2-128',
      }),
    },
  ],
}

const mantaMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 46,
      keyPrefix: '0x4ae7e256f92e5888372d72f3e4db1003b20b1df17c1eb8537e32dc07a9bfe191',
      assetIdType: 'u128',
      mapEntry: mapAssetsAndLocations({
        chainId: networks.manta,
        assetMetadataType: 'MantaPrimitivesAssetsAssetRegistryMetadata',
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db1003f4f3777447099e92d2a7274f5bbd71a6',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MantaPrimitivesAssetsAssetLocation',
        metadataHashing: 'blake2-128',
      }),
    },
  ],
}

const assetHubMapper: AssetMapper = {
  mappings: [
    {
      // assets pallet
      palletInstance: 50,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'u32',
      mapEntry: (registry: Registry, keyArgs: string, assetIdType: string, _ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<NonNullable<AssetMetadata>> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(registry, assetIdType, keyArgs, 'blake2-128').toString()
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
              } as NonNullable<AssetMetadata>
            }),
          )
        }
      },
    },
    {
      // Foreign assets pallet
      palletInstance: 53,
      keyPrefix: '0x30e64a56026f4b5e3c2d196283a9a17db5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'StagingXcmV3MultiLocation',
      mapEntry: (registry: Registry, keyArgs: string, assetIdType: string) => {
        return (source: Observable<Uint8Array>): Observable<NonNullable<AssetMetadata>> => {
          return source.pipe(
            map((buffer) => {
              const multiLocation = keyValue(registry, assetIdType, keyArgs, 'blake2-128')
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
              } as NonNullable<AssetMetadata>
            }),
          )
        }
      },
    },
  ],
}

export const mappers: Record<string, AssetMapper> = {
  [networks.polkadot]: BYPASS_MAPPER,
  [networks.assethub]: assetHubMapper,
  [networks.bifrost]: bifrostMapper,
  [networks.astar]: astarMapper,
  [networks.interlay]: interlayMapper,
  [networks.centrifuge]: centrifugeMapper,
  [networks.hydration]: hydrationMapper,
  [networks.moonbeam]: moonbeamMapper,
  [networks.manta]: mantaMapper,
}

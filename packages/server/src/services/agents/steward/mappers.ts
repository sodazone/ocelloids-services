import { Registry } from '@polkadot/types-codec/types'
import { u8aConcat } from '@polkadot/util'

import { Observable, map, mergeMap, of } from 'rxjs'

import { IngressConsumer } from '@/services/ingress/index.js'
import { NetworkURN } from '@/services/types.js'
import { fromKeyPrefix, keyValue } from './keys.js'
import {
  mapAssetsPalletAndLocations,
  mapAssetsPalletAssets,
  mapAssetsRegistryAndLocations,
  mapAssetsRegistryMetadata,
} from './ops.js'
import { AssetMapper, AssetMetadata, networks } from './types.js'

const BYPASS_MAPPER: AssetMapper = {
  mappings: [],
}

const astarMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 36,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2d34371a193a751eea5883e9553457b2e',
      assetIdType: 'u128',
      mapEntry: mapAssetsPalletAndLocations({
        chainId: networks.astar,
        multiLocationKeyPrefix: '0x9f5ad049cfbc7f413497855ef0232d4ea6718f60b6df3f6a17994cdf85e14dd4',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'XcmVersionedMultiLocation',
        multiLocationHashing: 'xx-64',
        options: {},
      }),
    },
  ],
}

const moonbeamMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 104,
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2d34371a193a751eea5883e9553457b2e',
      assetIdType: 'u128',
      mapEntry: mapAssetsPalletAndLocations({
        chainId: networks.moonbeam,
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db10031e932ed06f88c7a37d7c7c3f5fbeca1c',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MoonbeamRuntimeXcmConfigAssetType',
        options: {},
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
      mapEntry: mapAssetsRegistryMetadata({
        chainId: networks.centrifuge,
        assetMetadataType: 'OrmlTraitsAssetRegistryAssetMetadata',
        hashing: 'xx-64',
        options: {
          ed: 'existentialDeposit',
        },
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
      resolveKey: (registry, assetIdData) => {
        let fullKey = new Uint8Array()
        for (const aidData of assetIdData) {
          const keyValue = aidData.data.slice(0, aidData.length)
          fullKey = u8aConcat(fullKey, keyValue)
        }
        try {
          const v = registry.createType('InterbtcPrimitivesCurrencyId', fullKey) as unknown as any
          if (v.isToken) {
            return `native:${v.asToken.toString()}`
          }
          if (v.isForeignAsset) {
            return v.asForeignAsset.toString()
          }
        } catch (_error) {
          //
        }

        return 'none'
      },
      mapEntry: mapAssetsRegistryMetadata({
        chainId: networks.interlay,
        assetMetadataType: 'OrmlTraitsAssetRegistryAssetMetadata',
        hashing: 'xx-64',
        options: {
          ed: 'existentialDeposit',
        },
      }),
    },
  ],
}

const pendulumMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 53,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625b5f3822e35ca2f31ce3526eab1363fd2',
      assetIdType: 'SpacewalkPrimitivesCurrencyId',
      resolveKey: (registry, assetIdData) => {
        let fullKey = new Uint8Array()
        for (const aidData of assetIdData) {
          const keyValue = aidData.data.slice(0, aidData.length)
          // mapping to Pendulem Asset Enum
          // ref: https://github.com/pendulum-chain/spacewalk/blob/d74009bf1d8c27fbd1f314c4fe486cd230e8b73f/primitives/src/lib.rs#L471
          if (aidData.length === 4) {
            fullKey = u8aConcat(fullKey, Uint8Array.from([1]))
          } else if (aidData.length === 12) {
            fullKey = u8aConcat(fullKey, Uint8Array.from([2]))
          }
          fullKey = u8aConcat(fullKey, keyValue)
        }
        try {
          return registry.createType('SpacewalkPrimitivesCurrencyId', fullKey).toString()
        } catch (_error) {
          return 'none'
        }
      },
      mapEntry: mapAssetsRegistryMetadata({
        chainId: networks.pendulum,
        assetMetadataType: 'OrmlTraitsAssetRegistryAssetMetadata',
        hashing: 'xx-64',
        options: {
          ed: 'existentialDeposit',
        },
      }),
    },
  ],
}

const acalaMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 122,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625b7affc73a3c113dc6f4c7d986a1ddd88',
      assetIdType: 'AcalaPrimitivesCurrencyAssetIds',
      mapEntry: (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            mapAssetsRegistryMetadata({
              chainId: networks.acala,
              assetMetadataType: 'AcalaPrimitivesCurrencyAssetMetadata',
              hashing: 'xx-64',
              options: {
                ed: 'minimalBalance',
              },
            })(registry, keyArgs, assetIdType),
            mergeMap((asset: AssetMetadata) => {
              const { foreignAssetId } = JSON.parse(asset.id)
              if (foreignAssetId !== undefined) {
                const key = fromKeyPrefix(
                  registry,
                  '0x6e9a9b71050cd23f2d7d1b72e8c1a625fad40092576b1c80229f32a85897a124',
                  'u16',
                  foreignAssetId,
                  'xx-64',
                  false,
                )
                return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                  map((buffer) => {
                    const maybeLoc = registry.createType('StagingXcmV3MultiLocation', buffer)
                    if (maybeLoc.toHex() !== '0x0000') {
                      return {
                        ...asset,
                        multiLocation: maybeLoc.toJSON(),
                      } as AssetMetadata
                    } else {
                      return asset
                    }
                  }),
                )
              }
              return of(asset)
            }),
          )
        }
      },
    },
  ],
}

const bifrostMapper: AssetMapper = {
  mappings: [
    {
      palletInstance: 114,
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6259988d804f8bb04d82c701e7f01fb9764',
      assetIdType: 'BifrostPrimitivesCurrencyCurrencyId',
      mapEntry: mapAssetsRegistryAndLocations({
        chainId: networks.bifrost,
        assetMetadataType: 'BifrostAssetRegistryAssetMetadata',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6255f54cd54ea84dd94c101101f587e088d',
        multiLocationKeyType: 'BifrostPrimitivesCurrencyCurrencyId',
        multiLocationDataType: 'StagingXcmV3MultiLocation',
        metadataHashing: 'xx-64',
        options: {
          ed: 'minimalBalance',
        },
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
      mapEntry: mapAssetsRegistryAndLocations({
        chainId: networks.hydration,
        assetMetadataType: 'PalletAssetRegistryAssetDetails',
        multiLocationKeyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6252dc0b8ee4c66b0b3e24b03ec002e2544',
        multiLocationKeyType: 'u32',
        multiLocationDataType: 'HydradxRuntimeXcmAssetLocation',
        metadataHashing: 'blake2-128',
        options: {
          ed: 'existentialDeposit',
          isSufficient: 'isSufficient',
        },
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
      mapEntry: mapAssetsRegistryAndLocations({
        chainId: networks.manta,
        assetMetadataType: 'MantaPrimitivesAssetsAssetRegistryMetadata',
        multiLocationKeyPrefix: '0x4ae7e256f92e5888372d72f3e4db1003f4f3777447099e92d2a7274f5bbd71a6',
        multiLocationKeyType: 'u128',
        multiLocationDataType: 'MantaPrimitivesAssetsAssetLocation',
        metadataHashing: 'blake2-128',
        options: {
          ed: 'minBalance',
          isSufficient: 'isSufficient',
          extractMetadata: ({ metadata }) => ({
            name: metadata?.name,
            symbol: metadata?.symbol,
            decimals: metadata?.decimals,
          }),
        },
      }),
    },
  ],
}

const assetHubMapper = (chainId: string) =>
  ({
    mappings: [
      {
        // Assets pallet
        palletInstance: 50,
        // Assets Details
        keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2d34371a193a751eea5883e9553457b2e',
        assetIdType: 'u32',
        mapEntry: mapAssetsPalletAssets(chainId),
      },
      {
        // Foreign assets pallet
        palletInstance: 53,
        keyPrefix: '0x30e64a56026f4b5e3c2d196283a9a17dd34371a193a751eea5883e9553457b2e',
        assetIdType: 'StagingXcmV3MultiLocation',
        mapEntry: (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
          return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
            return source.pipe(
              map((buffer) => {
                const multiLocation = keyValue(registry, assetIdType, keyArgs, 'blake2-128', true)
                const assetId = multiLocation
                const assetDetails = registry.createType('PalletAssetsAssetDetails', buffer)

                return {
                  id: assetId.toString(),
                  xid: assetId.toHex(),
                  updated: Date.now(),
                  isSufficient: assetDetails.isSufficient.toPrimitive(),
                  existentialDeposit: assetDetails.minBalance.toString(),
                  chainId,
                  multiLocation: multiLocation.toJSON(),
                  raw: assetDetails.toJSON(),
                } as AssetMetadata
              }),
              mergeMap((asset) => {
                const key = fromKeyPrefix(
                  registry,
                  '0x30e64a56026f4b5e3c2d196283a9a17db5f3822e35ca2f31ce3526eab1363fd2',
                  assetIdType,
                  JSON.parse(asset.id),
                  'blake2-128',
                  false,
                )
                return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                  map((buffer) => {
                    const maybeDetails = registry.createType('AssetMetadata', buffer)

                    if (maybeDetails.toHex() !== '0x0000') {
                      const assetDetails = (maybeDetails.toHuman() as Record<string, any>) ?? {}
                      return {
                        ...asset,
                        name: assetDetails.name,
                        symbol: assetDetails.symbol,
                        decimals: assetDetails.decimals,
                        raw: {
                          ...asset.raw,
                          ...assetDetails,
                        },
                      }
                    } else {
                      return asset
                    }
                  }),
                )
              }),
            )
          }
        },
      },
    ],
  }) as AssetMapper

export const mappers: Record<string, AssetMapper> = {
  [networks.polkadot]: BYPASS_MAPPER,
  [networks.bridgeHub]: BYPASS_MAPPER,
  [networks.nodle]: BYPASS_MAPPER,
  [networks.phala]: BYPASS_MAPPER,
  [networks.mythos]: BYPASS_MAPPER,
  [networks.pendulum]: pendulumMapper,
  [networks.assetHub]: assetHubMapper(networks.assetHub),
  [networks.acala]: acalaMapper,
  [networks.bifrost]: bifrostMapper,
  [networks.astar]: astarMapper,
  [networks.interlay]: interlayMapper,
  [networks.centrifuge]: centrifugeMapper,
  [networks.hydration]: hydrationMapper,
  [networks.moonbeam]: moonbeamMapper,
  [networks.manta]: mantaMapper,
  [networks.kusama]: BYPASS_MAPPER,
  [networks.kusamaBridgeHub]: BYPASS_MAPPER,
  [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: assetHubMapper(networks.kusamaAssetHub),
}

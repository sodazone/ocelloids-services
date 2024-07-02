import { Registry } from '@polkadot/types-codec/types'
import { hexToU8a, u8aConcat, u8aToU8a } from '@polkadot/util'
import { blake2AsU8a, xxhashAsU8a } from '@polkadot/util-crypto'

import { Observable, map, mergeMap } from 'rxjs'

import { HexString } from '../../../lib.js'
import { IngressConsumer } from '../../ingress/index.js'
import { AnyJson, NetworkURN } from '../../types.js'
import { AssetMapper, AssetMetadata } from './types.js'

const OFFSET_128 = 16 * 2
const OFFSET_64 = 8 * 2

function keyValue(registry: Registry, type: string, keyArgs: string, offset = OFFSET_128) {
  return registry.createType(type, hexToU8a('0x' + keyArgs.substring(offset)))
}

const blake2128concat = (data: string | Buffer | Uint8Array) =>
  u8aConcat(blake2AsU8a(data, 128), u8aToU8a(data))

const xx64concat = (data: string | Buffer | Uint8Array) => u8aConcat(xxhashAsU8a(data, 64), u8aToU8a(data))

const moonbeamMapper: AssetMapper = {
  mappings: [
    {
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: (registry: Registry, keyArgs: string, ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(registry, 'u128', keyArgs).toString()
              const assetDetails =
                (registry.createType('PalletAssetsAssetMetadata', buffer).toHuman() as Record<string, any>) ??
                {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: 'urn:ocn:polkadot:2004',
                raw: {
                  ...assetDetails,
                  keyArgs,
                },
              } as AssetMetadata
            }),
            mergeMap((asset) => {
              // Expand AssetManager.assetIdType
              const key = ('0x4ae7e256f92e5888372d72f3e4db10031e932ed06f88c7a37d7c7c3f5fbeca1c' +
                Buffer.from(blake2128concat(keyValue(registry, 'u128', asset.raw.keyArgs).toU8a())).toString(
                  'hex',
                )) as HexString
              return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                map((buffer) => {
                  const maybeLoc = registry.createType('MoonbeamRuntimeXcmConfigAssetType', buffer)
                  if (maybeLoc.toHex() !== '0x0000') {
                    const json = maybeLoc.toJSON() as Record<string, AnyJson>
                    return {
                      ...asset,
                      multiLocation: json.xcm,
                    } as AssetMetadata
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
}

const bifrostMapper: AssetMapper = {
  mappings: [
    {
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a6259988d804f8bb04d82c701e7f01fb9764',
      mapEntry: (registry: Registry, keyArgs: string, ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(
                registry,
                'BifrostPrimitivesCurrencyCurrencyId',
                keyArgs,
                OFFSET_64,
              ).toString()
              const assetDetails =
                (registry.createType('BifrostAssetRegistryAssetMetadata', buffer).toHuman() as any) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: 'urn:ocn:polkadot:2030',
                raw: {
                  ...assetDetails,
                  keyArgs,
                },
              } as AssetMetadata
            }),
            mergeMap((asset) => {
              // Expand AssetRegistry.currencyIdToLocations
              const key = ('0x6e9a9b71050cd23f2d7d1b72e8c1a6255f54cd54ea84dd94c101101f587e088d' +
                Buffer.from(
                  xx64concat(
                    keyValue(
                      registry,
                      'BifrostPrimitivesCurrencyCurrencyId',
                      asset.raw.keyArgs,
                      OFFSET_64,
                    ).toU8a(),
                  ),
                ).toString('hex')) as HexString
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
            }),
          )
        }
      },
    },
  ],
}

const hydrationMapper: AssetMapper = {
  mappings: [
    {
      keyPrefix: '0x6e9a9b71050cd23f2d7d1b72e8c1a625682a59d51ab9e48a8c8cc418ff9708d2',
      mapEntry: (registry: Registry, keyArgs: string, ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(registry, 'u32', keyArgs).toString()
              const assetDetails =
                (registry.createType('PalletAssetRegistryAssetDetails', buffer).toHuman() as any) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: 'urn:ocn:polkadot:2034',
                raw: {
                  ...assetDetails,
                  keyArgs,
                },
              } as AssetMetadata
            }),
            mergeMap((asset) => {
              // Expand AssetRegistry.assetLocations
              const key = ('0x6e9a9b71050cd23f2d7d1b72e8c1a6252dc0b8ee4c66b0b3e24b03ec002e2544' +
                Buffer.from(blake2128concat(keyValue(registry, 'u32', asset.raw.keyArgs).toU8a())).toString(
                  'hex',
                )) as HexString
              return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                map((buffer) => {
                  const maybeLoc = registry.createType('HydradxRuntimeXcmAssetLocation', buffer)
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
            }),
          )
        }
      },
    },
  ],
}

const assetHubMapper: AssetMapper = {
  mappings: [
    {
      keyPrefix: '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: (registry: Registry, keyArgs: string, _ingress: IngressConsumer) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = keyValue(registry, 'u32', keyArgs).toString()
              const assetDetails =
                (registry.createType('AssetMetadata', buffer).toHuman() as Record<string, any>) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: 'urn:ocn:polkadot:1000',
                raw: assetDetails,
              } as AssetMetadata
            }),
          )
        }
      },
    },
    {
      // Foreign assets
      keyPrefix: '0x30e64a56026f4b5e3c2d196283a9a17db5f3822e35ca2f31ce3526eab1363fd2',
      mapEntry: (registry: Registry, keyArgs: string) => {
        return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const multiLocation = keyValue(registry, 'StagingXcmV3MultiLocation', keyArgs)
              const assetId = multiLocation.toString()
              const assetDetails =
                (registry.createType('AssetMetadata', buffer).toHuman() as Record<string, any>) ?? {}

              return {
                id: assetId,
                updated: Date.now(),
                name: assetDetails.name,
                symbol: assetDetails.symbol,
                decimals: assetDetails.decimals,
                chainId: 'urn:ocn:polkadot:1000',
                multiLocation: multiLocation.toJSON(),
                raw: assetDetails,
              }
            }),
          )
        }
      },
    },
  ],
}

export const mappers: Record<string, AssetMapper> = {
  'urn:ocn:polkadot:1000': assetHubMapper,
  'urn:ocn:polkadot:2030': bifrostMapper,
  'urn:ocn:polkadot:2034': hydrationMapper,
  'urn:ocn:polkadot:2004': moonbeamMapper,
}

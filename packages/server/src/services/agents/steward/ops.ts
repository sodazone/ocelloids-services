import { Registry } from '@polkadot/types-codec/types'
import { Observable, map, mergeMap } from 'rxjs'

import { HexString, NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'

import { Hashing, fromKeyPrefix, keyValue } from './keys.js'

import { AssetMetadata } from './types.js'
import { getLocationIfAny } from './util.js'

type MapOptions = {
  ed?: string
  isSufficient?: string
  extractMetadata?: (data: Record<string, any>) => {
    name: string
    symbol: string
    decimals: number
  }
}
type MapMultiLocationOptions = {
  chainId: string
  assetMetadataType: string
  metadataHashing: Hashing
  multiLocationHashing?: Hashing
  multiLocationKeyType: string
  multiLocationKeyPrefix: HexString
  multiLocationDataType: string
  options: MapOptions
  onMultiLocationData?: (json: Record<string, any>) => Record<string, any>
}

export const mapAssetsRegistryMetadata = ({
  chainId,
  assetMetadataType,
  hashing,
  options,
}: {
  chainId: string
  assetMetadataType: string
  hashing: Hashing
  options?: MapOptions
}) => {
  return (registry: Registry, keyArgs: string, assetIdType: string) => {
    return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
      return source.pipe(
        map((buffer) => {
          const assetId = keyValue(registry, assetIdType, keyArgs, hashing, true).toString()
          const assetDetails =
            (registry.createType(assetMetadataType, buffer).toHuman() as Record<string, any>) ?? {}
          const existentialDeposit = options?.ed
            ? (assetDetails[options.ed] as string).replaceAll(',', '')
            : undefined
          const isSufficient = options?.isSufficient
            ? assetDetails[options.isSufficient] === 'true'
            : undefined
          const extractMetadata = options?.extractMetadata
            ? options.extractMetadata
            : (data: Record<string, any>) => ({
                name: data.name,
                symbol: data.symbol,
                decimals: data.decimals,
              })
          return {
            chainId,
            id: assetId,
            updated: Date.now(),
            ...extractMetadata(assetDetails),
            multiLocation: getLocationIfAny(assetDetails),
            existentialDeposit,
            isSufficient,
            raw: {
              ...assetDetails,
              keyArgs,
            },
          } as AssetMetadata
        }),
      )
    }
  }
}

export const mapAssetsPalletAssets =
  (chainId: string) =>
  (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
    return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
      return source.pipe(
        map((buffer) => {
          const assetId = keyValue(registry, assetIdType, keyArgs, 'blake2-128', true).toString()
          const assetDetails = registry.createType('PalletAssetsAssetDetails', buffer)
          return {
            id: assetId,
            updated: Date.now(),
            existentialDeposit: assetDetails.minBalance.toString(),
            isSufficient: assetDetails.isSufficient.toPrimitive(),
            chainId,
            raw: assetDetails.toJSON(),
          } as AssetMetadata
        }),
        // Assets Metadata
        mergeMap((asset) => {
          const key = fromKeyPrefix(
            registry,
            '0x682a59d51ab9e48a8c8cc418ff9708d2b5f3822e35ca2f31ce3526eab1363fd2',
            assetIdType,
            asset.id,
            'blake2-128',
            false,
          )
          return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
            map((buffer) => {
              const assetDetails =
                (registry.createType('PalletAssetsAssetMetadata', buffer).toHuman() as Record<string, any>) ??
                {}
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
            }),
          )
        }),
      )
    }
  }

const mergeMultiLocations = ({
  metadataHashing,
  multiLocationHashing = metadataHashing,
  multiLocationKeyType,
  multiLocationKeyPrefix,
  multiLocationDataType,
  onMultiLocationData,
}: MapMultiLocationOptions) => {
  return (registry: Registry, ingress: IngressConsumer) => {
    return mergeMap((asset: AssetMetadata) => {
      // Expand multilocations
      const key = fromKeyPrefix(
        registry,
        multiLocationKeyPrefix,
        multiLocationKeyType,
        asset.raw.keyArgs ?? asset.id,
        multiLocationHashing,
        asset.raw.keyArgs !== undefined,
      )
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
    })
  }
}

export const mapAssetsPalletAndLocations = (
  options: Omit<MapMultiLocationOptions, 'assetMetadataType' | 'metadataHashing'>,
) => {
  return (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
    return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
      return source.pipe(
        mapAssetsPalletAssets(options.chainId)(registry, keyArgs, assetIdType, ingress),
        mergeMultiLocations({
          ...options,
          assetMetadataType: '',
          metadataHashing: 'blake2-128',
        })(registry, ingress),
      )
    }
  }
}

export const mapAssetsRegistryAndLocations = (options: MapMultiLocationOptions) => {
  return (registry: Registry, keyArgs: string, assetIdType: string, ingress: IngressConsumer) => {
    return (source: Observable<Uint8Array>): Observable<AssetMetadata> => {
      const { chainId, assetMetadataType, metadataHashing } = options
      return source.pipe(
        mapAssetsRegistryMetadata({
          chainId,
          assetMetadataType,
          hashing: metadataHashing,
          options: options.options,
        })(registry, keyArgs, assetIdType),
        mergeMultiLocations(options)(registry, ingress),
      )
    }
  }
}

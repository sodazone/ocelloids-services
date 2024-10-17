import { Observable, map, mergeMap } from 'rxjs'

import { HexString, NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'

import { asSerializable } from '../base/util.js'
import { AssetMetadata, StorageCodecs, WithRequired } from './types.js'
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
  options: MapOptions
  onMultiLocationData?: (json: Record<string, any>) => Record<string, any>
}

export const mapAssetsRegistryMetadata = ({
  chainId,
  options,
}: {
  chainId: string
  options?: MapOptions
}) => {
  return (codecs: WithRequired<StorageCodecs, 'assets'>, keyArgs: string) => {
    const codec = codecs.assets
    return (source: Observable<HexString>): Observable<AssetMetadata> => {
      return source.pipe(
        map((buffer) => {
          const assetId = codec.keyDecoder(keyArgs)[0]
          const assetDetails = buffer ? codec.dec(buffer) : {}
          const existentialDeposit = options?.ed ? assetDetails[options.ed].toString() : undefined
          const isSufficient = options?.isSufficient ? assetDetails[options.isSufficient] : undefined
          const extractMetadata = options?.extractMetadata
            ? options.extractMetadata
            : (data: Record<string, any>) => ({
                name: data.name?.asText(),
                symbol: data.symbol?.asText(),
                decimals: data.decimals,
              })
          return {
            chainId,
            id: asSerializable(assetId),
            xid: keyArgs,
            updated: Date.now(),
            ...extractMetadata(assetDetails),
            multiLocation: getLocationIfAny(assetDetails),
            existentialDeposit,
            isSufficient,
            externalIds: [],
            raw: asSerializable({
              ...assetDetails,
              keyArgs,
            }),
          } as AssetMetadata
        }),
      )
    }
  }
}

export const mapAssetsPalletAssets =
  (codecs: WithRequired<StorageCodecs, 'assets' | 'metadata'>, chainId: string) =>
  (keyArgs: string, ingress: IngressConsumer) => {
    const assetCodec = codecs.assets
    const assetMetadataCodec = codecs.metadata

    return (source: Observable<HexString>): Observable<AssetMetadata> => {
      return source.pipe(
        map((buffer) => {
          const assetId = assetCodec.keyDecoder(keyArgs)[0]
          const assetDetails = assetCodec.dec(buffer)
          return {
            id: assetId.toString(),
            xid: keyArgs,
            updated: Date.now(),
            existentialDeposit: assetDetails.min_balance.toString(),
            isSufficient: assetDetails.is_sufficient,
            chainId,
            raw: asSerializable(assetDetails),
            externalIds: [],
          } as AssetMetadata
        }),
        // Assets Metadata
        mergeMap((asset) => {
          const key = assetMetadataCodec.enc(asset.id) as HexString
          return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
            map((buffer) => {
              const assetDetails = buffer ? assetMetadataCodec.dec(buffer) : {}
              return {
                ...asset,
                name: assetDetails.name?.asText(),
                symbol: assetDetails.symbol?.asText(),
                decimals: assetDetails.decimals,
                raw: asSerializable({
                  ...asset.raw,
                  ...assetDetails,
                }),
              }
            }),
          )
        }),
      )
    }
  }

const mergeMultiLocations = (
  codecs: WithRequired<StorageCodecs, 'locations'>,
  { onMultiLocationData }: MapMultiLocationOptions,
) => {
  return (ingress: IngressConsumer) => {
    const codec = codecs.locations
    return mergeMap((asset: AssetMetadata) => {
      // Expand multilocations
      const key = codec.enc(asset.id) as HexString
      return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
        map((buffer) => {
          if (buffer === null || buffer.length === 0) {
            return asset
          }
          const maybeLoc = codec.dec(buffer)
          if (maybeLoc) {
            const multiLocation =
              onMultiLocationData === undefined
                ? asSerializable(maybeLoc)
                : onMultiLocationData(asSerializable(maybeLoc) as Record<string, any>)
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

export const mapAssetsPalletAndLocations = (options: MapMultiLocationOptions) => {
  return (codecs: Required<StorageCodecs>, keyArgs: string, ingress: IngressConsumer) => {
    return (source: Observable<HexString>): Observable<AssetMetadata> => {
      return source.pipe(
        mapAssetsPalletAssets(codecs, options.chainId)(keyArgs, ingress),
        mergeMultiLocations(codecs, options)(ingress),
      )
    }
  }
}

export const mapAssetsRegistryAndLocations = (
  codecs: WithRequired<StorageCodecs, 'assets' | 'locations'>,
  options: MapMultiLocationOptions,
) => {
  return (keyArgs: string, ingress: IngressConsumer) => {
    return (source: Observable<HexString>): Observable<AssetMetadata> => {
      const { chainId } = options
      return source.pipe(
        mapAssetsRegistryMetadata({
          chainId,
          options: options.options,
        })(codecs, keyArgs),
        mergeMultiLocations(codecs, options)(ingress),
      )
    }
  }
}

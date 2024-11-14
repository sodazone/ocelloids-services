import { Observable, map, mergeMap } from 'rxjs'

import { HexString, NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'

import {
  Blake2128,
  Blake2128Concat,
  Blake2256,
  Identity,
  Twox64Concat,
  Twox128,
  Twox256,
} from '@polkadot-api/substrate-bindings'

import { asSerializable } from '@/common/util.js'
import { Hashers } from '@/services/networking/types.js'
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
  codecs,
  options,
}: {
  chainId: string
  codecs: WithRequired<StorageCodecs, 'assets'>
  options?: MapOptions
}) => {
  return (keyArgs: string) => {
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
            id: assetId,
            xid: keyArgs,
            updated: Date.now(),
            ...extractMetadata(assetDetails),
            multiLocation: getLocationIfAny(assetDetails),
            existentialDeposit,
            isSufficient,
            externalIds: [],
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
            id: assetId,
            xid: keyArgs,
            updated: Date.now(),
            existentialDeposit: assetDetails.min_balance.toString(),
            isSufficient: assetDetails.is_sufficient,
            chainId,
            raw: assetDetails,
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
            const multiLocation = onMultiLocationData === undefined ? maybeLoc : onMultiLocationData(maybeLoc)
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
  codecs: WithRequired<StorageCodecs, 'assets' | 'metadata' | 'locations'>,
  options: MapMultiLocationOptions,
) => {
  return (keyArgs: string, ingress: IngressConsumer) => {
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
          codecs,
          options: options.options,
        })(keyArgs),
        mergeMultiLocations(codecs, options)(ingress),
      )
    }
  }
}

export const hashItemPartialKey = (data: Uint8Array, hashers: Hashers) => {
  if (hashers.length > 1) {
    throw new Error('Multiple hasher not supported')
  }
  const hasher = hashers[0]
  switch (hasher.tag) {
    case 'Blake2128':
      return Blake2128(data)
    case 'Blake2256':
      return Blake2256(data)
    case 'Blake2128Concat':
      return Blake2128Concat(data)
    case 'Twox128':
      return Twox128(data)
    case 'Twox256':
      return Twox256(data)
    case 'Twox64Concat':
      return Twox64Concat(data)
    case 'Identity':
      return Identity(data)
  }
}

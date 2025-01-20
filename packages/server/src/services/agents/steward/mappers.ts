import { Observable, map, mergeMap } from 'rxjs'

import { HexString } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { ApiContext } from '@/services/networking/client/index.js'
import { NetworkURN } from '@/services/types.js'
import { toHex } from 'polkadot-api/utils'
import {
  hashItemPartialKey,
  mapAssetsPalletAndLocations,
  mapAssetsPalletAssets,
  mapAssetsRegistryAndLocations,
  mapAssetsRegistryMetadata,
} from './ops.js'
import { AssetMapper, AssetMetadata, StorageCodecs, WithRequired, networks } from './types.js'

const BYPASS_MAPPER: AssetMapper = () => []

const astarMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('Assets', 'Asset')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'metadata' | 'locations'> = {
    assets: codec,
    metadata: context.storageCodec('Assets', 'Metadata'),
    locations: context.storageCodec('XcAssetConfig', 'AssetIdToLocation'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsPalletAndLocations(codecs, {
        chainId: networks.astar,
        options: {},
      }),
    },
  ]
  return mappings
}

const moonbeamMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('Assets', 'Asset')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'metadata' | 'locations'> = {
    assets: codec,
    metadata: context.storageCodec('Assets', 'Metadata'),
    locations: context.storageCodec('AssetManager', 'AssetIdType'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsPalletAndLocations(codecs, {
        chainId: networks.moonbeam,
        options: {
          ed: 'minimal_balance',
        },
        onMultiLocationData: (json: Record<string, any>) => json.value,
      }),
    },
  ]
  return mappings
}

const hyperbridgeMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('Assets', 'Asset')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'metadata' | 'locations'> = {
    assets: codec,
    metadata: context.storageCodec('TokenGovernor', 'AssetMetadatas'),
    locations: context.storageCodec('XcmGateway', 'AssetIds'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsPalletAndLocations(codecs, {
        chainId: networks.hyperbridge,
        options: {
          ed: 'minimal_balance',
        },
      }),
    },
  ]
  return mappings
}

const bifrostMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('AssetRegistry', 'CurrencyMetadatas')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'locations'> = {
    assets: codec,
    locations: context.storageCodec('AssetRegistry', 'CurrencyIdToLocations'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsRegistryAndLocations(codecs, {
        chainId: networks.bifrost,
        options: {
          ed: 'minimal_balance',
        },
      }),
      mapAssetId: (data: Uint8Array) => {
        // context get hasher
        const hashers = context.getHashers('AssetRegistry', 'CurrencyMetadatas')
        let itemPartialKey = toHex(data)
        if (hashers !== null) {
          itemPartialKey = toHex(hashItemPartialKey(data, hashers))
        }
        const dec = codec.keys.dec(keyPrefix + itemPartialKey.slice(2))
        return dec
      },
    },
  ]
  return mappings
}

const hydrationMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('AssetRegistry', 'Assets')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'locations'> = {
    assets: codec,
    locations: context.storageCodec('AssetRegistry', 'AssetLocations'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsRegistryAndLocations(codecs, {
        chainId: networks.hydration,
        options: {
          ed: 'existential_deposit',
          isSufficient: 'is_sufficient',
        },
      }),
    },
  ]
  return mappings
}

const centrifugeMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('OrmlAssetRegistry', 'Metadata')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets'> = {
    assets: codec,
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsRegistryMetadata({
        chainId: networks.centrifuge,
        codecs,
        options: {
          ed: 'existential_deposit',
          extractMetadata: (data) => ({
            decimals: data.decimals,
            name: data.name?.asText(),
            symbol: data.symbol?.asText(),
          }),
        },
      }),
      mapAssetId: (data: Uint8Array) => {
        // context get hasher
        const hashers = context.getHashers('OrmlAssetRegistry', 'Metadata')
        let itemPartialKey = toHex(data)
        if (hashers !== null) {
          itemPartialKey = toHex(hashItemPartialKey(data, hashers))
        }
        const dec = codec.keys.dec(keyPrefix + itemPartialKey.slice(2))
        return dec
      },
    },
  ]
  return mappings
}

const assetHubMapper = (chainId: string) => (context: ApiContext) => {
  const codec = context.storageCodec('Assets', 'Asset')
  const keyPrefix = codec.keys.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'metadata'> = {
    assets: codec,
    metadata: context.storageCodec('Assets', 'Metadata'),
  }

  const foreignAssetsCodec = context.storageCodec('ForeignAssets', 'Asset')
  const foreignAssetsKeyPrefix = foreignAssetsCodec.keys.enc() as HexString
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsPalletAssets(codecs, chainId),
    },
    {
      // Foreign assets pallet
      keyPrefix: foreignAssetsKeyPrefix,
      mapEntry: (keyArgs: string, ingress: IngressConsumer) => {
        const assetCodec = foreignAssetsCodec
        const assetMetadataCodec = context.storageCodec('ForeignAssets', 'Metadata')
        return (source: Observable<HexString>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = assetCodec.keys.dec(keyArgs)[0]
              const multiLocation = assetId
              const assetDetails = assetCodec.value.dec(buffer)

              return {
                id: assetId,
                xid: keyArgs,
                updated: Date.now(),
                isSufficient: assetDetails.is_sufficient,
                existentialDeposit: assetDetails.min_balance.toString(),
                chainId,
                multiLocation,
                raw: assetDetails,
              } as AssetMetadata
            }),
            mergeMap((asset) => {
              const key = assetMetadataCodec.keys.enc(asset.id) as HexString
              return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                map((buffer) => {
                  const assetDetails = buffer ? assetMetadataCodec.value.dec(buffer) : null
                  if (assetDetails) {
                    return {
                      ...asset,
                      name: assetDetails.name.asText(),
                      symbol: assetDetails.symbol.asText(),
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
  ]
  return mappings
}

export const mappers: Record<string, AssetMapper> = {
  [networks.polkadot]: BYPASS_MAPPER,
  [networks.bridgeHub]: BYPASS_MAPPER,
  [networks.nodle]: BYPASS_MAPPER,
  [networks.phala]: BYPASS_MAPPER,
  [networks.mythos]: BYPASS_MAPPER,
  [networks.moonbeam]: moonbeamMapper,
  [networks.astar]: astarMapper,
  [networks.assetHub]: assetHubMapper(networks.assetHub),
  [networks.bifrost]: bifrostMapper,
  [networks.centrifuge]: centrifugeMapper,
  [networks.hydration]: hydrationMapper,
  [networks.interlay]: BYPASS_MAPPER,
  [networks.polimec]: BYPASS_MAPPER,
  [networks.hyperbridge]: hyperbridgeMapper,
  [networks.kusama]: BYPASS_MAPPER,
  [networks.kusamaBridgeHub]: BYPASS_MAPPER,
  [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: assetHubMapper(networks.kusamaAssetHub),
  [networks.paseo]: BYPASS_MAPPER,
  [networks.paseoAssetHub]: assetHubMapper(networks.paseoAssetHub),
}

import { Binary } from 'polkadot-api'
import {
  combineLatest,
  EMPTY,
  expand,
  filter,
  from,
  map,
  mergeMap,
  Observable,
  of,
  reduce,
  shareReplay,
  switchMap,
} from 'rxjs'
import { AbiFunction, erc20Abi, zeroAddress } from 'viem'
import { asJSON } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { getChainId, getConsensus } from '@/services/config.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { TOKEN_GATEWAYS } from '../config.js'

const STORAGE_PAGE_LEN = 100

export type AssetMetadata = {
  symbol?: string
  decimals?: number
}

export type Asset = AssetMetadata & {
  key: string
}

export type TokenGovernorAsset = {
  assetId: HexString
  name: string
  symbol: string
}

export type MapperContext = {
  log: Logger
  ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
}

export type AssetMapper = (
  chainId: NetworkURN,
  assets$: Observable<TokenGovernorAsset[]>,
) => Observable<Asset>

const gatewayViewFunctions: AbiFunction[] = [
  {
    name: 'erc20',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'erc6160',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
]

function isZeroAddress(address: string) {
  return address.startsWith(zeroAddress)
}

function bifrostAssetMapper({ ingress }: MapperContext) {
  const apis = ingress.substrate

  return (chainId: NetworkURN, assets$: Observable<TokenGovernorAsset[]>): Observable<Asset> => {
    const supportedAssets$ = apis.getContext(chainId).pipe(
      switchMap((ctx) => {
        const codec = ctx.storageCodec('TokenGateway', 'SupportedAssets')
        const keyPrefix = codec.keys.enc() as HexString

        return apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN).pipe(
          expand((keys) =>
            keys.length === STORAGE_PAGE_LEN
              ? apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
              : EMPTY,
          ),
          reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          mergeMap((keys) =>
            apis.queryStorageAt(chainId, keys).pipe(
              map((changeSets) => {
                const changes = changeSets[0]?.changes ?? []
                return changes
                  .map(([storageKey, rawValue]) => {
                    if (!rawValue) {
                      return null
                    }
                    const keyArgs = codec.keys.dec(storageKey) as [Record<string, any>]
                    const value = codec.value.dec(rawValue) as Binary
                    return { key: keyArgs[0], assetId: value.asHex() }
                  })
                  .filter((i) => i !== null)
              }),
            ),
          ),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    const decimals$ = apis.getContext(chainId).pipe(
      switchMap((ctx) => {
        const codec = ctx.storageCodec('TokenGateway', 'Decimals')
        const keyPrefix = codec.keys.enc() as HexString

        return apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN).pipe(
          expand((keys) =>
            keys.length === STORAGE_PAGE_LEN
              ? apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
              : EMPTY,
          ),
          reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          mergeMap((keys) =>
            apis.queryStorageAt(chainId, keys).pipe(
              map((changeSets) => {
                const changes = changeSets[0]?.changes ?? []
                return changes
                  .map(([storageKey, rawValue]) => {
                    if (!rawValue) {
                      return null
                    }
                    const keyArgs = codec.keys.dec(storageKey) as [Record<string, any>]
                    const value = codec.value.dec(rawValue) as number
                    return { key: keyArgs[0], decimals: value }
                  })
                  .filter((i) => i !== null)
              }),
            ),
          ),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    return combineLatest([assets$, supportedAssets$, decimals$]).pipe(
      mergeMap(([assets, supportedAssets, decimals]) => {
        const assetsById = new Map(assets.map((a) => [a.assetId, a]))

        return supportedAssets.map(({ key, assetId }) => {
          const dec = decimals.find((d) => asJSON(d.key) === asJSON(key))
          const meta = assetsById.get(assetId)

          return {
            key: `${chainId}|${assetId}`,
            symbol: meta?.symbol,
            decimals: dec?.decimals,
          } as Asset
        })
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
  }
}

function hydrationAssetMapper({ ingress }: MapperContext) {
  const apis = ingress.substrate

  return (chainId: NetworkURN, assets$: Observable<TokenGovernorAsset[]>): Observable<Asset> => {
    const supportedAssets$ = apis.getContext(chainId).pipe(
      switchMap((ctx) => {
        const codec = ctx.storageCodec('TokenGateway', 'SupportedAssets')
        const keyPrefix = codec.keys.enc() as HexString

        return apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN).pipe(
          expand((keys) =>
            keys.length === STORAGE_PAGE_LEN
              ? apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
              : EMPTY,
          ),
          reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          mergeMap((keys) =>
            apis.queryStorageAt(chainId, keys).pipe(
              map((changeSets) => {
                const changes = changeSets[0]?.changes ?? []
                return changes
                  .map(([storageKey, rawValue]) => {
                    if (!rawValue) {
                      return null
                    }
                    const keyArgs = codec.keys.dec(storageKey) as [Record<string, any>]
                    const value = codec.value.dec(rawValue) as Binary
                    return { key: keyArgs[0], assetId: value.asHex() }
                  })
                  .filter((i) => i !== null)
              }),
            ),
          ),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    const decimals$ = apis.getContext(chainId).pipe(
      switchMap((ctx) => {
        const codec = ctx.storageCodec('TokenGateway', 'Precisions')
        const keyPrefix = codec.keys.enc() as HexString

        return apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN).pipe(
          expand((keys) =>
            keys.length === STORAGE_PAGE_LEN
              ? apis.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
              : EMPTY,
          ),
          reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          mergeMap((keys) =>
            apis.queryStorageAt(chainId, keys).pipe(
              map((changeSets) => {
                const changes = changeSets[0]?.changes ?? []
                return changes
                  .map(([storageKey, rawValue]) => {
                    if (!rawValue) {
                      return null
                    }
                    const keyArgs = codec.keys.dec(storageKey) as [number, Record<string, any>]
                    const value = codec.value.dec(rawValue) as number
                    return { key: keyArgs, decimals: value }
                  })
                  .filter((i) => i !== null)
              }),
            ),
          ),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    return combineLatest([assets$, supportedAssets$, decimals$]).pipe(
      mergeMap(([assets, supportedAssets, decimals]) => {
        const assetsById = new Map(assets.map((a) => [a.assetId, a]))

        return supportedAssets.map(({ key, assetId }) => {
          const dec = decimals.find(
            (d) =>
              d.key[1].type.toLowerCase() === getConsensus(chainId) &&
              d.key[1].value.toString() === getChainId(chainId) &&
              asJSON(d.key[0]) === asJSON(key),
          )
          const meta = assetsById.get(assetId)

          return {
            key: `${chainId}|${assetId}`,
            symbol: meta?.symbol,
            decimals: dec?.decimals,
          } as Asset
        })
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
  }
}

function hyperbridgeAssetMapper(ctx: MapperContext) {
  return (chainId: NetworkURN, assets$: Observable<TokenGovernorAsset[]>): Observable<Asset> => {
    return assets$.pipe(
      map((assets) => {
        const dot = assets.find((a) => a.symbol === 'DOT')
        if (dot !== undefined) {
          return {
            key: `${chainId}|${dot.assetId}`,
            symbol: dot.symbol,
            decimals: 18,
          } as Asset
        }
        ctx.log.warn('DOT asset not found in list of Token Governor assets')
        return null
      }),
      filter((a) => a !== null),
    )
  }
}

export function fetchEvmAssetsMetadataBatch$(
  ingress: EvmIngressConsumer,
  chainId: NetworkURN,
  assets$: Observable<TokenGovernorAsset[]>,
) {
  const tokenGateway = TOKEN_GATEWAYS[chainId]
  return assets$.pipe(
    mergeMap((assets) => {
      const gatewayCalls = assets.flatMap(({ assetId }) => [
        {
          address: tokenGateway,
          abi: gatewayViewFunctions,
          functionName: 'erc20',
          args: [assetId],
        },
        {
          address: tokenGateway,
          abi: gatewayViewFunctions,
          functionName: 'erc6160',
          args: [assetId],
        },
      ])

      return from(ingress.multicall(chainId, { contracts: gatewayCalls })).pipe(
        map((results) => ({ assets, results })),
      )
    }),
    mergeMap(({ assets, results }) => {
      const tokenAddresses = assets.map((_a, i) => {
        const erc20Addr = results[i * 2]?.result as string
        const erc6160Addr = results[i * 2 + 1]?.result as string
        return (isZeroAddress(erc20Addr) ? erc20Addr : erc6160Addr) as HexString
      })

      const metaCalls = tokenAddresses.flatMap((addr) =>
        isZeroAddress(addr)
          ? []
          : [
              { address: addr, abi: erc20Abi, functionName: 'symbol' },
              { address: addr, abi: erc20Abi, functionName: 'decimals' },
            ],
      )

      if (metaCalls.length === 0) {
        return of([])
      }

      return from(ingress.multicall(chainId, { contracts: metaCalls })).pipe(
        map((metaResults) => {
          const mapped: Asset[] = []
          let idx = 0

          for (let i = 0; i < assets.length; i++) {
            const tokenAddr = tokenAddresses[i]
            if (isZeroAddress(tokenAddr)) {
              continue
            }

            const symbol = metaResults[idx++]?.result as string
            const decimals = metaResults[idx++]?.result as number

            mapped.push({
              key: `${chainId}|${assets[i].assetId}`,
              symbol,
              decimals,
            })
          }

          return mapped
        }),
      )
    }),
    mergeMap((assets) => assets),
  )
}

function evmAssetMapper({ ingress }: MapperContext) {
  const apis = ingress.evm
  return (chainId: NetworkURN, assets$: Observable<TokenGovernorAsset[]>): Observable<Asset> => {
    return fetchEvmAssetsMetadataBatch$(apis, chainId, assets$)
  }
}

export function getAssetMappers(ctx: MapperContext): Record<string, AssetMapper> {
  return {
    'urn:ocn:polkadot:2030': bifrostAssetMapper(ctx),
    'urn:ocn:polkadot:2034': hydrationAssetMapper(ctx),
    'urn:ocn:polkadot:3367': hyperbridgeAssetMapper(ctx),
    'urn:ocn:ethereum:1': evmAssetMapper(ctx), // Ethereum
    'urn:ocn:ethereum:42161': evmAssetMapper(ctx), // Arbitrum
    'urn:ocn:ethereum:10': evmAssetMapper(ctx), // Optimism
    'urn:ocn:ethereum:8453': evmAssetMapper(ctx), // Base
    'urn:ocn:ethereum:56': evmAssetMapper(ctx), // BSC
    'urn:ocn:ethereum:100': evmAssetMapper(ctx), // Gnosis
    'urn:ocn:ethereum:1868': evmAssetMapper(ctx), // Soneium
    'urn:ocn:ethereum:137': evmAssetMapper(ctx), // Polygon
    'urn:ocn:ethereum:130': evmAssetMapper(ctx), // Unichain
  }
}

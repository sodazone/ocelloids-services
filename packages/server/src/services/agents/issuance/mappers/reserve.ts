import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  exhaustMap,
  filter,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  timer,
} from 'rxjs'
import { encodeFunctionData, erc20Abi } from 'viem'
import { publicKeyToSS58 } from '@/common/address.js'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { networks } from '@/services/agents/common/networks.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import {
  extractEthereumRuntimeRpcCallBalance,
  getBalanceExtractor,
} from '@/services/networking/substrate/balances.js'
import { toFrontierRuntimeQuery } from '@/services/networking/substrate/evm/helpers.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import {
  decodeSovereignAccount,
  deriveSovereignAccount,
  isXcmLocation,
  serializeStorageKeyArg,
} from '@/services/networking/substrate/util.js'
import { RETRY_INFINITE } from '@/services/networking/watcher.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { AssetId } from '../../steward/types.js'

const POLLING_INTERVAL = 60_000

function createStorageContext(
  apiCtx: SubstrateApiContext,
  pallet: string,
  storage: string,
  keyArgs: unknown[],
) {
  const codec = apiCtx.storageCodec(pallet, storage)
  const extractor = getBalanceExtractor(pallet, storage)

  if (!extractor) {
    return null
  }

  return {
    storageKey: codec.keys.enc(...keyArgs) as HexString,
    decode: (value: HexString) => (value !== null ? extractor(codec.value.dec(value)) : null),
  }
}

function systemAccount(apiCtx: SubstrateApiContext, address: string) {
  return createStorageContext(apiCtx, 'System', 'Account', [address])
}

function assetsAccount(apiCtx: SubstrateApiContext, assetId: number, address: string) {
  return createStorageContext(apiCtx, 'Assets', 'Account', [assetId, address])
}

function foreignAssetsAccount(apiCtx: SubstrateApiContext, assetId: any, address: string) {
  return createStorageContext(apiCtx, 'ForeignAssets', 'Account', [serializeStorageKeyArg(assetId), address])
}

const storageResolvers: Record<
  NetworkURN,
  (args: { apiCtx: SubstrateApiContext; assetId: AssetId; address: string }) => {
    storageKey: HexString
    decode: (value: HexString) => bigint | null
  } | null
> = {
  [networks.polkadot]: ({ apiCtx, assetId, address }) =>
    assetId === 'native' ? systemAccount(apiCtx, address) : null,

  [networks.kusama]: ({ apiCtx, assetId, address }) =>
    assetId === 'native' ? systemAccount(apiCtx, address) : null,

  [networks.assetHub]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    if (typeof assetId === 'number') {
      return assetsAccount(apiCtx, assetId, address)
    }
    if (isXcmLocation(assetId)) {
      return foreignAssetsAccount(apiCtx, assetId, address)
    }
    return null
  },
  [networks.kusamaAssetHub]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    if (typeof assetId === 'number') {
      return assetsAccount(apiCtx, assetId, address)
    }
    if (isXcmLocation(assetId)) {
      return foreignAssetsAccount(apiCtx, assetId, address)
    }
    return null
  },
  [networks.moonbeam]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    return null
  },
  [networks.astar]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    if (typeof assetId === 'number') {
      return assetsAccount(apiCtx, assetId, address)
    }
    return null
  },
  [networks.bifrost]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    if (typeof assetId === 'object' && 'type' in assetId && 'value' in assetId) {
      return createStorageContext(apiCtx, 'Tokens', 'Accounts', [address, assetId])
    }
    return null
  },
  [networks.hydration]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return systemAccount(apiCtx, address)
    }
    if (typeof assetId === 'number') {
      return createStorageContext(apiCtx, 'Tokens', 'Accounts', [address, assetId])
    }
    return null
  },
}

function pollSubstrateStorage(
  ingress: IngressConsumers,
  chainId: NetworkURN,
  resolverArgs: { assetId: AssetId; address: string },
): Observable<bigint> {
  return ingress.substrate.getContext(chainId).pipe(
    switchMap((apiCtx) => {
      const storageContext = storageResolvers[chainId]({
        apiCtx,
        ...resolverArgs,
      })

      if (!storageContext) {
        throw new Error(`[${chainId}] storage resolver not defined`)
      }

      const { storageKey, decode } = storageContext

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() => ingress.substrate.getStorage(chainId, storageKey)),
        map(decode),
        filter((v): v is bigint => v !== null),
        distinctUntilChanged(),
      )
    }),
  )
}

function pollDualSubstrateSum(
  ingress: IngressConsumers,
  chainA: NetworkURN,
  chainB: NetworkURN,
  resolverA: { assetId: AssetId; address: string },
  resolverB: { assetId: AssetId; address: string },
): Observable<bigint> {
  return combineLatest([ingress.substrate.getContext(chainA), ingress.substrate.getContext(chainB)]).pipe(
    switchMap(([ctxA, ctxB]) => {
      const storageA = storageResolvers[chainA]({
        apiCtx: ctxA,
        ...resolverA,
      })

      const storageB = storageResolvers[chainB]({
        apiCtx: ctxB,
        ...resolverB,
      })

      if (!storageA || !storageB) {
        throw new Error(`Storage resolver not defined`)
      }

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() =>
          forkJoin([
            ingress.substrate.getStorage(chainA, storageA.storageKey),
            ingress.substrate.getStorage(chainB, storageB.storageKey),
          ]),
        ),
        map(([valA, valB]) => {
          const a = storageA.decode(valA)
          const b = storageB.decode(valB)

          if (a === null || b === null) {
            return null
          }

          return a + b
        }),
        filter((v): v is bigint => v !== null),
        distinctUntilChanged(),
      )
    }),
  )
}

export function reserveBalanceMappers(
  ingress: IngressConsumers,
): Record<string, (ctx: { assetId: AssetId; address: string }) => Observable<bigint>> {
  return {
    [networks.assetHub]: ({ assetId, address }) => {
      const { prefix, paraId } = decodeSovereignAccount(address)

      if (assetId === 'native' && prefix === 'sibl') {
        return pollDualSubstrateSum(
          ingress,
          networks.assetHub,
          networks.polkadot,
          { assetId, address },
          {
            assetId,
            address: publicKeyToSS58(deriveSovereignAccount(paraId, 'para'), 0),
          },
        )
      }

      return pollSubstrateStorage(ingress, networks.assetHub, {
        assetId,
        address,
      })
    },

    [networks.kusamaAssetHub]: ({ assetId, address }) =>
      pollSubstrateStorage(ingress, networks.kusamaAssetHub, { assetId, address }),

    [networks.astar]: ({ assetId, address }) =>
      pollSubstrateStorage(ingress, networks.astar, { assetId, address }),

    [networks.bifrost]: ({ assetId, address }) =>
      pollSubstrateStorage(ingress, networks.bifrost, { assetId, address }),

    [networks.hydration]: ({ assetId, address }) =>
      pollSubstrateStorage(ingress, networks.hydration, { assetId, address }),

    [networks.moonbeam]: ({ assetId, address }) => {
      const chainId = networks.moonbeam
      if (typeof assetId !== 'string') {
        throw new Error('Moonbeam reserve asset ID must be a string')
      }
      if (!address.startsWith('0x') && address.length !== 42) {
        throw new Error('Moonbeam reserve address must be a 20-byte hex string starting with "0x"')
      }
      if (assetId === 'native') {
        return pollSubstrateStorage(ingress, chainId, { assetId, address })
      }
      if (assetId.startsWith('0x')) {
        const callData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address as HexString],
        })

        const { api, method, args } = toFrontierRuntimeQuery({
          callData,
          contractAddress: assetId as HexString,
        })

        return timer(0, POLLING_INTERVAL).pipe(
          exhaustMap(() =>
            from(
              ingress.substrate.runtimeCall(
                chainId,
                {
                  api,
                  method,
                },
                args,
              ),
            ).pipe(retryWithTruncatedExpBackoff(RETRY_INFINITE)),
          ),
          map(extractEthereumRuntimeRpcCallBalance),
          filter((value) => value !== null),
          distinctUntilChanged(),
        )
      }

      throw new Error(`Unknown Moonbeam asset type ${assetId}`)
    },
    [networks.ethereum]: ({ assetId, address }) => {
      const chainId = networks.ethereum
      if (typeof assetId !== 'string') {
        throw new Error('Ethereum reserve asset ID must be a string')
      }
      if (!address.startsWith('0x') || address.length !== 42) {
        throw new Error('Ethereum reserve address must be a 20-byte hex string starting with "0x"')
      }

      if (assetId === 'native') {
        return timer(0, POLLING_INTERVAL).pipe(
          exhaustMap(() =>
            from(ingress.evm.getBalance(chainId, { address: address as HexString })).pipe(
              retryWithTruncatedExpBackoff(RETRY_INFINITE),
            ),
          ),
          filter((value): value is bigint => value !== null),
          distinctUntilChanged(),
        )
      }

      if (assetId.startsWith('0x')) {
        const callData = {
          address: assetId as HexString,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address as HexString],
        }

        return timer(0, POLLING_INTERVAL).pipe(
          exhaustMap(() =>
            from(ingress.evm.readContract<bigint>(chainId, callData)).pipe(
              catchError((error) => {
                console.error(error, 'read contract error')
                return of(null)
              }),
            ),
          ),
          filter((value): value is bigint => value !== null),
          distinctUntilChanged(),
        )
      }

      throw new Error(`Unknown Ethereum asset type ${assetId}`)
    },
  }
}

import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  from,
  map,
  Observable,
  of,
  switchMap,
  timer,
} from 'rxjs'
import { encodeFunctionData, erc20Abi } from 'viem'
import { networks } from '@/services/agents/common/networks.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import {
  extractEthereumRuntimeRpcCallBalance,
  getBalanceExtractor,
} from '@/services/networking/substrate/balances.js'
import { toFrontierRuntimeQuery } from '@/services/networking/substrate/evm/helpers.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { isXcmLocation, serializeStorageKeyArg } from '@/services/networking/substrate/util.js'
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

const storageResolvers: Record<
  NetworkURN,
  (args: { apiCtx: SubstrateApiContext; assetId: AssetId; address: string }) => {
    storageKey: HexString
    decode: (value: HexString) => bigint | null
  } | null
> = {
  [networks.assetHub]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return createStorageContext(apiCtx, 'System', 'Account', [address])
    }

    if (typeof assetId === 'number') {
      return createStorageContext(apiCtx, 'Assets', 'Account', [assetId, address])
    }

    if (isXcmLocation(assetId)) {
      return createStorageContext(apiCtx, 'ForeignAssets', 'Account', [
        serializeStorageKeyArg(assetId),
        address,
      ])
    }

    return null
  },
  [networks.kusamaAssetHub]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return createStorageContext(apiCtx, 'System', 'Account', [address])
    }

    if (typeof assetId === 'number') {
      return createStorageContext(apiCtx, 'Assets', 'Account', [assetId, address])
    }

    if (isXcmLocation(assetId)) {
      return createStorageContext(apiCtx, 'ForeignAssets', 'Account', [
        serializeStorageKeyArg(assetId),
        address,
      ])
    }

    return null
  },
  [networks.astar]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return createStorageContext(apiCtx, 'System', 'Account', [address])
    }

    if (typeof assetId === 'number') {
      return createStorageContext(apiCtx, 'Assets', 'Account', [assetId, address])
    }

    return null
  },
  [networks.bifrost]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return createStorageContext(apiCtx, 'System', 'Account', [address])
    }

    if (typeof assetId === 'object' && 'type' in assetId && 'value' in assetId) {
      return createStorageContext(apiCtx, 'Tokens', 'Accounts', [address, assetId])
    }

    return null
  },
  [networks.hydration]: ({ apiCtx, assetId, address }) => {
    if (assetId === 'native') {
      return createStorageContext(apiCtx, 'System', 'Account', [address])
    }

    if (typeof assetId === 'number') {
      return createStorageContext(apiCtx, 'Tokens', 'Accounts', [address, assetId])
    }

    return null
  },
}

export function reserveBalanceMappers(
  ingress: IngressConsumers,
): Record<string, (ctx: { assetId: AssetId; address: string }) => Observable<bigint>> {
  return {
    [networks.assetHub]: ({ assetId, address }) => {
      const chainId = networks.assetHub

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const storageResolver = storageResolvers[chainId]
          const storageContext = storageResolver({ apiCtx, assetId, address })

          if (storageContext === null) {
            throw new Error(`[${chainId}] storage resolver not defined`)
          }
          const { decode, storageKey } = storageContext

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => decode(value)),
            filter((balance) => balance !== null),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.kusamaAssetHub]: ({ assetId, address }) => {
      const chainId = networks.kusamaAssetHub

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const storageResolver = storageResolvers[chainId]
          const storageContext = storageResolver({ apiCtx, assetId, address })

          if (storageContext === null) {
            throw new Error(`[${chainId}] storage resolver not defined`)
          }
          const { decode, storageKey } = storageContext

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => decode(value)),
            filter((balance) => balance !== null),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.astar]: ({ assetId, address }) => {
      const chainId = networks.astar

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const storageResolver = storageResolvers[chainId]
          const storageContext = storageResolver({ apiCtx, assetId, address })

          if (storageContext === null) {
            throw new Error(`[${chainId}] storage resolver not defined`)
          }
          const { decode, storageKey } = storageContext

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => decode(value)),
            filter((balance) => balance !== null),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.bifrost]: ({ assetId, address }) => {
      const chainId = networks.bifrost

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const storageResolver = storageResolvers[chainId]
          const storageContext = storageResolver({ apiCtx, assetId, address })

          if (storageContext === null) {
            throw new Error(`[${chainId}] storage resolver not defined`)
          }
          const { decode, storageKey } = storageContext

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => decode(value)),
            filter((balance) => balance !== null),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.hydration]: ({ assetId, address }) => {
      const chainId = networks.hydration

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const storageResolver = storageResolvers[chainId]
          const storageContext = storageResolver({ apiCtx, assetId, address })

          if (storageContext === null) {
            throw new Error(`[${chainId}] storage resolver not defined`)
          }
          const { decode, storageKey } = storageContext

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => decode(value)),
            filter((balance) => balance !== null),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.moonbeam]: ({ assetId, address }) => {
      const chainId = networks.moonbeam
      if (typeof assetId !== 'string') {
        throw new Error('Moonbeam reserve asset ID must be a string')
      }
      if (!address.startsWith('0x') && address.length !== 42) {
        throw new Error('Moonbeam reserve address must be a 20-byte hex string starting with "0x"')
      }
      if (assetId === 'native') {
        return ingress.substrate.getContext(chainId).pipe(
          switchMap((apiCtx) => {
            const storageContext = createStorageContext(apiCtx, 'System', 'Account', [address])
            if (storageContext === null) {
              throw new Error(`[${chainId}] storage resolver not defined`)
            }
            const { decode, storageKey } = storageContext

            return timer(0, POLLING_INTERVAL).pipe(
              exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
              map((value) => decode(value)),
              filter((balance) => balance !== null),
              distinctUntilChanged(),
            )
          }),
        )
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
            ingress.substrate.runtimeCall(
              chainId,
              {
                api,
                method,
              },
              args,
            ),
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
              catchError((error) => {
                console.error(error, 'get balance error')
                return of(null)
              }),
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

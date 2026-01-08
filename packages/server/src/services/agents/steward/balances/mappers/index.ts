import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { Binary } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'
import { filter, firstValueFrom } from 'rxjs'
import { isEVMAddress } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { AssetId, networks } from '../../types.js'
import { bigintToPaddedHex } from '../../util.js'
import {
  AssetsBalance,
  Balance,
  BalancesStreamMapper,
  CustomDiscoveryFetcher,
  NativeBalance,
  RuntimeCallMapper,
  StorageKeyMapper,
} from '../types.js'
import { calculateFreeBalance, getFrontierAccountStoragesSlot } from '../util.js'
import {
  assetsBalances$,
  foreignAssetsBalances$,
  toAssetsStorageKey,
  toForeignAssetsStorageKey,
} from './assets.js'
import { hydrationBalancesFetcher, hydrationCurrecies$, hydrationEVM$ } from './hydration.js'
import { moonbeamBalances$, toErc20RuntimeQuery, toEVMStorageKey } from './moonbeam.js'
import { nativeBalances$, toNativeStorageKey } from './native.js'
import { tokensBalances$, toTokenStorageKey } from './tokens.js'

const getDefaultBalancesStream: (chainId: NetworkURN) => BalancesStreamMapper = (chainId) => (ingress) => {
  return [nativeBalances$(chainId, ingress)]
}

export const balanceEventsSubscriptions: Record<string, BalancesStreamMapper> = {
  [networks.polkadot]: getDefaultBalancesStream(networks.polkadot),
  [networks.assetHub]: (ingress) => {
    const chainId = networks.assetHub
    return [
      nativeBalances$(chainId, ingress),
      assetsBalances$(chainId, ingress),
      foreignAssetsBalances$(chainId, ingress),
    ]
  },
  [networks.bridgeHub]: getDefaultBalancesStream(networks.bridgeHub),
  [networks.people]: getDefaultBalancesStream(networks.people),
  [networks.coretime]: getDefaultBalancesStream(networks.coretime),
  [networks.acala]: getDefaultBalancesStream(networks.acala),
  [networks.phala]: getDefaultBalancesStream(networks.phala),
  [networks.mythos]: (ingress, control) => {
    const chainId = networks.mythos
    const filtered$ = nativeBalances$(chainId, ingress).pipe(
      filter(({ data }) => {
        return control.value.test({
          account: data.publicKey,
        })
      }),
    )
    return [filtered$]
  },
  [networks.moonbeam]: (ingress) => {
    const chainId = networks.moonbeam
    return [nativeBalances$(chainId, ingress), moonbeamBalances$(chainId, ingress)]
  },
  [networks.astar]: (ingress) => {
    const chainId = networks.astar
    return [nativeBalances$(chainId, ingress), assetsBalances$(chainId, ingress)]
  },
  [networks.bifrost]: (ingress) => {
    const chainId = networks.bifrost
    return [nativeBalances$(chainId, ingress), tokensBalances$(chainId, ingress)]
  },
  [networks.centrifuge]: getDefaultBalancesStream(networks.centrifuge),
  [networks.hydration]: (ingress) => {
    const chainId = networks.hydration
    return [
      nativeBalances$(chainId, ingress),
      tokensBalances$(chainId, ingress),
      hydrationEVM$(chainId, ingress),
      hydrationCurrecies$(chainId, ingress),
    ]
  },
  [networks.interlay]: getDefaultBalancesStream(networks.interlay),
  [networks.hyperbridge]: getDefaultBalancesStream(networks.hyperbridge),
  [networks.kusama]: getDefaultBalancesStream(networks.kusama),
  [networks.kusamaBridgeHub]: getDefaultBalancesStream(networks.kusama),
  [networks.kusamaCoretime]: getDefaultBalancesStream(networks.kusamaCoretime),
  [networks.kusamaAssetHub]: (ingress) => {
    const chainId = networks.kusamaAssetHub
    return [
      nativeBalances$(chainId, ingress),
      assetsBalances$(chainId, ingress),
      foreignAssetsBalances$(chainId, ingress),
    ]
  },
  [networks.paseo]: getDefaultBalancesStream(networks.paseo),
  [networks.paseoAssetHub]: (ingress) => {
    const chainId = networks.paseoAssetHub
    return [
      nativeBalances$(chainId, ingress),
      assetsBalances$(chainId, ingress),
      foreignAssetsBalances$(chainId, ingress),
    ]
  },
}

const balanceExtractorMappers: Record<string, (value: any) => bigint> = {
  'assets.account': (value: AssetsBalance) => {
    return value.balance
  },
  'currenciesapi.account': (value: Balance) => {
    return calculateFreeBalance(value)
  },
  'ethereumruntimerpcapi.call': (value: any) => {
    if (typeof value === 'bigint') {
      return value
    } else if (typeof value === 'object' && value.success && 'value' in value) {
      try {
        const v = value.value.value as Binary
        return BigInt(v.asBytes().length > 0 ? v.asHex() : 0)
      } catch (err) {
        console.warn(err, 'Balance extractor error in ethereumruntimerpcapi.call')
      }
    }
    return 0n
  },
  'evm.accountstorages': (value: Binary) => {
    return BigInt(value.asHex())
  },
  'foreignassets.account': (value: AssetsBalance) => {
    return value.balance
  },
  'system.account': ({ data }: NativeBalance) => {
    return calculateFreeBalance(data)
  },
  'tokens.accounts': (value: Balance) => {
    return calculateFreeBalance(value)
  },
}

export function getBalanceExtractor(...path: string[]) {
  return balanceExtractorMappers[path.map((p) => p.toLowerCase()).join('.')]
}

function skipEVMAccounts<T extends (...args: any[]) => any>(mapper: T): T {
  return ((assetId, account, apiCtx) => {
    if (isEVMAddress(account)) {
      return null
    }
    return mapper(assetId, account, apiCtx)
  }) as T
}

const baseDefaultStorageKeyMapper: StorageKeyMapper = ({ id }, account, apiCtx) => {
  if (id === 'native') {
    const ss58Account = fromBufferToBase58(0)(fromHex(account))
    return toNativeStorageKey(ss58Account, apiCtx)
  }
  return null
}

const assetHubStorageKeyMapper: StorageKeyMapper = ({ id }, account, apiCtx) => {
  const ss58Account = fromBufferToBase58(0)(fromHex(account))
  if (id === 'native') {
    return toNativeStorageKey(ss58Account, apiCtx)
  }
  if (typeof id === 'number' || typeof id === 'string') {
    return toAssetsStorageKey(id, ss58Account, apiCtx)
  }
  if (typeof id === 'object' && 'parents' in id) {
    return toForeignAssetsStorageKey(id, ss58Account, apiCtx)
  }
  return null
}

export const balancesStorageMappers: Record<string, StorageKeyMapper | null> = {
  [networks.polkadot]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.assetHub]: skipEVMAccounts(assetHubStorageKeyMapper),
  [networks.bridgeHub]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.people]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.coretime]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.acala]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.phala]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.mythos]: ({ id }, account, apiCtx) => {
    if (account.length > 42) {
      // Substrate addresses cannot be mapped to Mythos EVM address
      return null
    }
    if (id === 'native') {
      return toNativeStorageKey(account, apiCtx)
    }
    return null
  },
  [networks.moonbeam]: ({ id }, account, apiCtx) => {
    if (account.length > 42) {
      // Substrate addresses cannot be mapped to Moonbeam EVM address
      return null
    }
    if (id === 'native') {
      return toNativeStorageKey(account, apiCtx)
    }

    if (typeof id === 'string') {
      if (id.startsWith('0x')) {
        return null
      }
      const contractAddress = bigintToPaddedHex(BigInt(id))
      const slot = getFrontierAccountStoragesSlot(account, 0)
      return toEVMStorageKey(contractAddress, slot, apiCtx)
    }
    return null
  },
  [networks.astar]: skipEVMAccounts(({ id }, account, apiCtx) => {
    const ss58Account = fromBufferToBase58(0)(fromHex(account))
    if (id === 'native') {
      return toNativeStorageKey(ss58Account, apiCtx)
    }
    try {
      const assetId = BigInt(id)
      return toAssetsStorageKey(assetId, ss58Account, apiCtx)
    } catch (_e) {
      return null
    }
  }),
  [networks.bifrost]: skipEVMAccounts(({ id }, account, apiCtx) => {
    const ss58Account = fromBufferToBase58(0)(fromHex(account))
    if (id === 'native') {
      return toNativeStorageKey(ss58Account, apiCtx)
    }
    return toTokenStorageKey(id, ss58Account, apiCtx)
  }),
  [networks.centrifuge]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.hydration]: null, // uses custom fetcher
  [networks.interlay]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.hyperbridge]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.kusama]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.kusamaBridgeHub]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.kusamaCoretime]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.kusamaAssetHub]: skipEVMAccounts(assetHubStorageKeyMapper),
  [networks.paseo]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.paseoAssetHub]: skipEVMAccounts(assetHubStorageKeyMapper),
}

export const balancesRuntimeCallMappers: Record<string, RuntimeCallMapper | null> = {
  [networks.moonbeam]: ({ id }, account) => {
    if (account.length > 42 || typeof id !== 'string' || id === 'native' || !id.startsWith('0x')) {
      return null
    }

    return toErc20RuntimeQuery(account, id as HexString)
  },
}

export const customDiscoveryFetchers: Record<string, CustomDiscoveryFetcher> = {
  [networks.hydration]: hydrationBalancesFetcher,
}

export const onDemandFetchers: Record<string, CustomDiscoveryFetcher> = {
  [networks.mythos]: async ({ chainId, account, ingress, apiCtx }) => {
    const balances: {
      assetId: AssetId
      balance: bigint | null
    }[] = []
    if (account.length > 42) {
      // Substrate addresses cannot be mapped to Mythos EVM address
      return balances
    }

    const { storageKey, module, name } = toNativeStorageKey(account, apiCtx)
    const value = await firstValueFrom(ingress.getStorage(chainId, storageKey))
    const storageCodec = apiCtx.storageCodec(module, name)
    const balanceExtractor = getBalanceExtractor(module, name)
    if (balanceExtractor) {
      balances.push({
        assetId: 'native',
        balance: value !== null ? balanceExtractor(storageCodec.value.dec(value)) : null,
      })
    }
    return balances
  },
}

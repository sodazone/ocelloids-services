import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { Binary } from 'polkadot-api'

import { HexString, NetworkURN } from '@/lib.js'

import { isEVMAddress } from '@/common/util.js'
import { fromHex } from 'polkadot-api/utils'
import { networks } from '../../types.js'
import { bigintToPaddedHex } from '../../util.js'
import {
  AssetsBalance,
  Balance,
  BalancesSubscriptionMapper,
  CustomDiscoveryFetcher,
  NativeBalance,
  StorageKeyMapper,
} from '../types.js'
import { calculateFreeBalance, getFrontierAccountStoragesSlot } from '../util.js'
import {
  assetsBalancesSubscription,
  foreignAssetsBalancesSubscription,
  toAssetsStorageKey,
  toForeignAssetsStorageKey,
} from './assets.js'
import { hydrationBalancesFetcher, hydrationEVMSubscription } from './hydration-evm.js'
import { moonbeamBalancesSubscription, toEVMStorageKey } from './moonbeam.js'
import { nativeBalancesSubscription, toNativeStorageKey } from './native.js'
import { toTokenStorageKey, tokensBalancesSubscription } from './tokens.js'

const getDefaultBalancesSubscription: (chainId: NetworkURN) => BalancesSubscriptionMapper =
  (chainId) => (ingress, enqueue) => {
    return [nativeBalancesSubscription(chainId, ingress, enqueue)]
  }

export const balanceEventsSubscriptions: Record<string, BalancesSubscriptionMapper> = {
  [networks.polkadot]: getDefaultBalancesSubscription(networks.polkadot),
  [networks.assetHub]: (ingress, enqueue) => {
    const chainId = networks.assetHub
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
      foreignAssetsBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.bridgeHub]: getDefaultBalancesSubscription(networks.bridgeHub),
  [networks.people]: getDefaultBalancesSubscription(networks.people),
  [networks.coretime]: getDefaultBalancesSubscription(networks.coretime),
  [networks.acala]: getDefaultBalancesSubscription(networks.acala),
  [networks.phala]: getDefaultBalancesSubscription(networks.phala),
  [networks.mythos]: getDefaultBalancesSubscription(networks.mythos),
  [networks.moonbeam]: (ingress, enqueue) => {
    const chainId = networks.moonbeam
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      moonbeamBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.astar]: (ingress, enqueue) => {
    const chainId = networks.astar
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.bifrost]: (ingress, enqueue) => {
    const chainId = networks.bifrost
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      tokensBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.centrifuge]: getDefaultBalancesSubscription(networks.centrifuge),
  [networks.hydration]: (ingress, enqueue) => {
    const chainId = networks.hydration
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      tokensBalancesSubscription(chainId, ingress, enqueue),
      hydrationEVMSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.interlay]: getDefaultBalancesSubscription(networks.interlay),
  [networks.hyperbridge]: getDefaultBalancesSubscription(networks.hyperbridge),
  [networks.kusama]: getDefaultBalancesSubscription(networks.kusama),
  [networks.kusamaBridgeHub]: getDefaultBalancesSubscription(networks.kusama),
  [networks.kusamaCoretime]: getDefaultBalancesSubscription(networks.kusamaCoretime),
  [networks.kusamaAssetHub]: (ingress, enqueue) => {
    const chainId = networks.kusamaAssetHub
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
      foreignAssetsBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  [networks.paseo]: getDefaultBalancesSubscription(networks.paseo),
  [networks.paseoAssetHub]: (ingress, enqueue) => {
    const chainId = networks.paseoAssetHub
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
      foreignAssetsBalancesSubscription(chainId, ingress, enqueue),
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
    const slot = getFrontierAccountStoragesSlot(account, 0)
    if (typeof id === 'string') {
      if (id.startsWith('0x')) {
        return toEVMStorageKey(id as HexString, slot, apiCtx)
      }
      const contractAddress = bigintToPaddedHex(BigInt(id))
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

export const customDiscoveryFetchers: Record<string, CustomDiscoveryFetcher> = {
  [networks.hydration]: hydrationBalancesFetcher,
}

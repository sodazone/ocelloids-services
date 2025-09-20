import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { networks } from '../../types.js'
import { bigintToPaddedHex } from '../../util.js'
import {
  AssetsBalance,
  BalancesStorageKeyMapper,
  BalancesSubscriptionMapper,
  NativeBalance,
} from '../types.js'
import { calculateFreeBalance, getFrontierAccountStoragesSlot } from '../util.js'
import {
  assetsBalancesSubscription,
  foreignAssetsBalancesSubscription,
  toAssetsStorageKey,
  toForeignAssetsStorageKey,
} from './assets.js'
import { moonbeamBalancesSubscription, toEVMStorageKey } from './moonbeam.js'
import { nativeBalancesSubscription, toNativeStorageKey } from './native.js'

function isEVMAddress(account: string) {
  return account.startsWith('0x') && account.length === 42
}

const getDefaultBalancesSubscription: (chainId: NetworkURN) => BalancesSubscriptionMapper =
  (chainId) => (ingress, enqueue) => {
    return [nativeBalancesSubscription(chainId, ingress, enqueue)]
  }

export const balanceEventsSubscriptions: Record<string, BalancesSubscriptionMapper> = {
  [networks.polkadot]: getDefaultBalancesSubscription(networks.polkadot),
  // [networks.bridgeHub]: BYPASS_MAPPER,
  // [networks.people]: BYPASS_MAPPER,
  // [networks.coretime]: BYPASS_MAPPER,
  // [networks.acala]: acalaMapper,
  // [networks.nodle]: BYPASS_MAPPER,
  // [networks.phala]: BYPASS_MAPPER,
  // [networks.mythos]: BYPASS_MAPPER,
  [networks.moonbeam]: (ingress, enqueue) => {
    const chainId = networks.moonbeam
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      moonbeamBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  // [networks.astar]: astarMapper,
  [networks.assetHub]: (ingress, enqueue) => {
    const chainId = networks.assetHub
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
      foreignAssetsBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  // [networks.bifrost]: bifrostMapper,
  // [networks.centrifuge]: centrifugeMapper,
  // [networks.hydration]: hydrationMapper,
  // [networks.interlay]: interlayMapper,
  // [networks.manta]: BYPASS_MAPPER,
  // [networks.polimec]: BYPASS_MAPPER,
  // [networks.hyperbridge]: hyperbridgeMapper,
  [networks.kusama]: getDefaultBalancesSubscription(networks.kusama),
  [networks.kusamaBridgeHub]: getDefaultBalancesSubscription(networks.kusama),
  // [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: (ingress, enqueue) => {
    const chainId = networks.kusamaAssetHub
    return [
      nativeBalancesSubscription(chainId, ingress, enqueue),
      assetsBalancesSubscription(chainId, ingress, enqueue),
      foreignAssetsBalancesSubscription(chainId, ingress, enqueue),
    ]
  },
  // [networks.paseo]: BYPASS_MAPPER,
  // [networks.paseoAssetHub]: assetHubMapper(networks.paseoAssetHub),
}

export const balanceExtractorMappers: Record<string, (storageValue: unknown) => bigint> = {
  'Assets.Account': (storageValue: unknown) => {
    return (storageValue as AssetsBalance).balance
  },
  'Evm.AccountStorages': (storageValue: unknown) => {
    return BigInt(storageValue as HexString)
  },
  'ForeignAssets.Account': (storageValue: unknown) => {
    return (storageValue as AssetsBalance).balance
  },
  'System.Account': (storageValue: unknown) => {
    const { data } = storageValue as NativeBalance
    return calculateFreeBalance(data)
  },
}

function skipEVMAccounts<T extends (...args: any[]) => any>(mapper: T): T {
  return ((assetId, account, apiCtx) => {
    if (isEVMAddress(account)) {
      return null
    }
    return mapper(assetId, account, apiCtx)
  }) as T
}

const baseDefaultStorageKeyMapper: BalancesStorageKeyMapper = (
  _assetId: any,
  account: string,
  apiCtx: any,
) => {
  return toNativeStorageKey(account, apiCtx)
}

const assetHubStorageKeyMapper: BalancesStorageKeyMapper = (assetId, account, apiCtx) => {
  if (assetId === 'native') {
    return toNativeStorageKey(account, apiCtx)
  }
  if (typeof assetId === 'number' || typeof assetId === 'string') {
    return toAssetsStorageKey(assetId, account, apiCtx)
  }
  if (typeof assetId === 'object' && 'parents' in assetId) {
    return toForeignAssetsStorageKey(assetId, account, apiCtx)
  }
  return null
}

export const storageKeyMappers: Record<string, BalancesStorageKeyMapper> = {
  [networks.polkadot]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  // [networks.bridgeHub]: BYPASS_MAPPER,
  // [networks.people]: BYPASS_MAPPER,
  // [networks.coretime]: BYPASS_MAPPER,
  // [networks.acala]: acalaMapper,
  // [networks.nodle]: BYPASS_MAPPER,
  // [networks.phala]: BYPASS_MAPPER,
  // [networks.mythos]: BYPASS_MAPPER,
  [networks.moonbeam]: (assetId, account, apiCtx) => {
    const pubKey = asPublicKey(account)
    if (pubKey.length > 42) {
      // Substrate addresses cannot be mapped to Moonbeam EVM address
      return null
    }
    if (assetId === 'native') {
      return toNativeStorageKey(account, apiCtx)
    }
    const slot = getFrontierAccountStoragesSlot(pubKey, 0)
    if (typeof assetId === 'string') {
      if (assetId.startsWith('0x')) {
        return toEVMStorageKey(assetId as HexString, slot, apiCtx)
      }
      const contractAddress = bigintToPaddedHex(BigInt(assetId))
      return toEVMStorageKey(contractAddress, slot, apiCtx)
    }
    return null
  },
  // [networks.astar]: astarMapper,
  [networks.assetHub]: skipEVMAccounts(assetHubStorageKeyMapper),
  // [networks.bifrost]: bifrostMapper,
  // [networks.centrifuge]: centrifugeMapper,
  // [networks.hydration]: hydrationMapper,
  // [networks.interlay]: interlayMapper,
  // [networks.manta]: BYPASS_MAPPER,
  // [networks.polimec]: BYPASS_MAPPER,
  // [networks.hyperbridge]: hyperbridgeMapper,
  [networks.kusama]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  [networks.kusamaBridgeHub]: skipEVMAccounts(baseDefaultStorageKeyMapper),
  // [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: skipEVMAccounts(assetHubStorageKeyMapper),
  // [networks.paseo]: BYPASS_MAPPER,
  // [networks.paseoAssetHub]: assetHubMapper(networks.paseoAssetHub),
}

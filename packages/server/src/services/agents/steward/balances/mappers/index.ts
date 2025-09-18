import { NetworkURN } from '@/lib.js'
import { networks } from '../../types.js'
import {
  AssetsBalance,
  BalancesStorageKeyMapper,
  BalancesSubscriptionMapper,
  NativeBalance,
} from '../types.js'
import { calculateFreeBalance } from '../util.js'
import {
  assetsBalancesSubscription,
  foreignAssetsBalancesSubscription,
  toAssetsStorageKey,
  toForeignAssetsStorageKey,
} from './assets.js'
import { nativeBalancesSubscription, toNativeStorageKey } from './native.js'

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
  // [networks.moonbeam]: moonbeamMapper,
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
  'System.Account': (storageValue: unknown) => {
    const { data } = storageValue as NativeBalance
    return calculateFreeBalance(data)
  },
  'Assets.Account': (storageValue: unknown) => {
    return (storageValue as AssetsBalance).balance
  },
  'ForeignAssets.Account': (storageValue: unknown) => {
    return (storageValue as AssetsBalance).balance
  },
}

function getDefaultStorageKeyMapper(): BalancesStorageKeyMapper {
  return (_assetId, account, apiCtx) => toNativeStorageKey(account, apiCtx)
}

export const storageKeyMappers: Record<string, BalancesStorageKeyMapper> = {
  [networks.polkadot]: getDefaultStorageKeyMapper(),
  // [networks.bridgeHub]: BYPASS_MAPPER,
  // [networks.people]: BYPASS_MAPPER,
  // [networks.coretime]: BYPASS_MAPPER,
  // [networks.acala]: acalaMapper,
  // [networks.nodle]: BYPASS_MAPPER,
  // [networks.phala]: BYPASS_MAPPER,
  // [networks.mythos]: BYPASS_MAPPER,
  // [networks.moonbeam]: moonbeamMapper,
  // [networks.astar]: astarMapper,
  [networks.assetHub]: (assetId, account, apiCtx) => {
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
  },
  // [networks.bifrost]: bifrostMapper,
  // [networks.centrifuge]: centrifugeMapper,
  // [networks.hydration]: hydrationMapper,
  // [networks.interlay]: interlayMapper,
  // [networks.manta]: BYPASS_MAPPER,
  // [networks.polimec]: BYPASS_MAPPER,
  // [networks.hyperbridge]: hyperbridgeMapper,
  [networks.kusama]: getDefaultStorageKeyMapper(),
  [networks.kusamaBridgeHub]: getDefaultStorageKeyMapper(),
  // [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: (assetId, account, apiCtx) => {
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
  },
  // [networks.paseo]: BYPASS_MAPPER,
  // [networks.paseoAssetHub]: assetHubMapper(networks.paseoAssetHub),
}

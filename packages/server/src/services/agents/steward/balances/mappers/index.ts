import { networks } from '../../types.js'
import { AssetsBalance, BalancesSubscriptionMapper, NativeBalance, TokensBalance } from '../types.js'
import { assetsBalancesSubscription, foreignAssetsBalancesSubscription } from './assets.js'
import { nativeBalancesSubscription } from './native.js'

function calculateFreeBalance(data: TokensBalance): bigint {
  const { free, frozen } = data

  if (free < frozen) {
    return 0n
  }

  return free - frozen
}

const NATIVE_BALANCE_SUBS: BalancesSubscriptionMapper = (chainId, ingress, enqueue) => {
  return [nativeBalancesSubscription(chainId, ingress, enqueue)]
}

export const balanceEventsSubscriptions: Record<string, BalancesSubscriptionMapper> = {
  [networks.polkadot]: NATIVE_BALANCE_SUBS,
  // [networks.bridgeHub]: BYPASS_MAPPER,
  // [networks.people]: BYPASS_MAPPER,
  // [networks.coretime]: BYPASS_MAPPER,
  // [networks.acala]: acalaMapper,
  // [networks.nodle]: BYPASS_MAPPER,
  // [networks.phala]: BYPASS_MAPPER,
  // [networks.mythos]: BYPASS_MAPPER,
  // [networks.moonbeam]: moonbeamMapper,
  // [networks.astar]: astarMapper,
  [networks.assetHub]: (chainId, ingress, enqueue) => {
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
  // [networks.kusama]: BYPASS_MAPPER,
  // [networks.kusamaBridgeHub]: BYPASS_MAPPER,
  // [networks.kusamaCoretime]: BYPASS_MAPPER,
  // [networks.kusamaAssetHub]: assetHubMapper(networks.kusamaAssetHub),
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

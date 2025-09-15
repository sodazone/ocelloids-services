import { networks } from '../../types.js'
import { BalancesSubscriptionMapper } from '../types.js'
import { nativeBalancesMapper } from './native.js'

const NATIVE_MAPPER: BalancesSubscriptionMapper = (chainId, ingress, enqueue) => {
  return [nativeBalancesMapper(chainId, ingress, enqueue)]
}
export const mappers: Record<string, BalancesSubscriptionMapper> = {
  [networks.polkadot]: NATIVE_MAPPER,
  // [networks.bridgeHub]: BYPASS_MAPPER,
  // [networks.people]: BYPASS_MAPPER,
  // [networks.coretime]: BYPASS_MAPPER,
  // [networks.acala]: acalaMapper,
  // [networks.nodle]: BYPASS_MAPPER,
  // [networks.phala]: BYPASS_MAPPER,
  // [networks.mythos]: BYPASS_MAPPER,
  // [networks.moonbeam]: moonbeamMapper,
  // [networks.astar]: astarMapper,
  [networks.assetHub]: NATIVE_MAPPER,
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

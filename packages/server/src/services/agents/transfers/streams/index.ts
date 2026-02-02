import { Observable } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { Transfer } from '../types.js'
import { nativeTransfers$ } from './native.js'

type TransferStreamMapper = (blockEvents$: Observable<BlockEvent>) => Observable<Transfer>

export const transferStreamMappers: Record<string, TransferStreamMapper> = {
  [networks.polkadot]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.assetHub]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.bridgeHub]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.coretime]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.people]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.acala]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.moonbeam]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.astar]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.bifrost]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.hydration]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.hyperbridge]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
}

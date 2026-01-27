import { Observable } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { Transfer } from '../type.js'
import { nativeTransfers$ } from './native.js'

type TransferStreamMapper = (blockEvents$: Observable<BlockEvent>) => Observable<Transfer>

export const transferStreamMappers: Record<string, TransferStreamMapper> = {
  [networks.polkadot]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.assetHub]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
}

import { filter, map, Observable } from 'rxjs'
import { asPublicKey } from '@/common/util.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { Transfer } from '../types.js'

const PALLET_MODULE = 'balances'
const PALLET_EVENT = 'transfer'

export function nativeTransfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return blockEvents$.pipe(
    filter(
      (blockEvent) =>
        blockEvent.module.toLowerCase() === PALLET_MODULE && blockEvent.name.toLowerCase() === PALLET_EVENT,
    ),
    map((blockEvent) => {
      const { value, blockHash, blockNumber, extrinsic, timestamp, module, name, blockPosition } = blockEvent
      const { from, to, amount } = value

      return {
        asset: 'native',
        from: asPublicKey(from),
        to: asPublicKey(to),
        fromFormatted: from,
        toFormatted: to,
        amount,
        blockNumber: blockNumber.toString(),
        blockHash,
        timestamp,
        event: {
          module,
          name,
          blockPosition,
          value,
        },
        extrinsic,
      }
    }),
  )
}

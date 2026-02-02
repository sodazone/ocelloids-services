import { filter, map, Observable } from 'rxjs'
import { asPublicKey } from '@/common/util.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { toMelbourne } from '../../steward/util.js'
import { Transfer } from '../types.js'

const PALLET_MODULES = ['assets', 'foreignassets']
const PALLET_EVENT = 'transferred'

export function assetTransfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return blockEvents$.pipe(
    filter(
      (blockEvent) =>
        PALLET_MODULES.includes(blockEvent.module.toLowerCase()) &&
        blockEvent.name.toLowerCase() === PALLET_EVENT,
    ),
    map((blockEvent) => {
      const { value, blockHash, blockNumber, extrinsic, timestamp, module, name, blockPosition } = blockEvent
      const { from, to, amount, asset_id } = value

      return {
        asset: toMelbourne(asset_id),
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
        extrinsic: extrinsic,
      }
    }),
  )
}

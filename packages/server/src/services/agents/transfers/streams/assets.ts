import { filter, map, Observable } from 'rxjs'
import { asPublicKey } from '@/common/util.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { Transfer } from '../types.js'

const ASSET_MODULES = ['assets', 'foreignassets']
const ASSET_EVENT = 'transferred'

const CURRENCIES_MODULE = 'currencies'
const CURRENCIES_EVENT = 'transferred'

const TOKENS_MODULE = 'tokens'
const TOKENS_EVENT = 'transfer'

function toTransfer(
  blockEvent: BlockEvent,
  opts: {
    assetKey: 'currency_id' | 'asset_id'
  },
): Transfer {
  const { value, blockHash, blockNumber, extrinsic, timestamp, module, name, blockPosition } = blockEvent

  const { from, to, amount } = value
  const assetId = value[opts.assetKey]

  return {
    asset: assetId,
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
    },
    extrinsic,
  }
}

export function assetTransfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return blockEvents$.pipe(
    filter((e) => ASSET_MODULES.includes(e.module.toLowerCase()) && e.name.toLowerCase() === ASSET_EVENT),
    map((e) => toTransfer(e, { assetKey: 'asset_id' })),
  )
}

export function currenciesTransfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return blockEvents$.pipe(
    filter((e) => e.module.toLowerCase() === CURRENCIES_MODULE && e.name.toLowerCase() === CURRENCIES_EVENT),
    map((e) => toTransfer(e, { assetKey: 'currency_id' })),
  )
}

export function tokensTransfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return blockEvents$.pipe(
    filter((e) => e.module.toLowerCase() === TOKENS_MODULE && e.name.toLowerCase() === TOKENS_EVENT),
    map((e) => toTransfer(e, { assetKey: 'currency_id' })),
  )
}

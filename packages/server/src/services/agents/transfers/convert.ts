import { Twox256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'
import { padAccountKey20 } from '@/common/address.js'
import { asJSON, stringToUa8 } from '@/common/util.js'
import { BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NewIcTransfer } from './repositories/types.js'
import { EnrichedTransfer } from './types.js'

export function toTransferHash(t: EnrichedTransfer): string {
  return toHex(Twox256(stringToUa8(`${t.chainId}|${t.blockNumber}|${t.from}|${t.to}|${t.asset}|${t.amount}`)))
}

export function mapTransferToRow(t: EnrichedTransfer): NewIcTransfer {
  const blockPosition = t.event.blockPosition
  const txHash = t.extrinsic ? (t.extrinsic as BlockExtrinsic).hash : undefined
  const evmTxHash = t.extrinsic ? (t.extrinsic as BlockExtrinsic).evmTxHash : undefined

  return {
    transfer_hash: toTransferHash(t),
    network: t.chainId,
    block_number: t.blockNumber,
    block_hash: t.blockHash,
    event_index: blockPosition,
    sent_at: t.timestamp,
    created_at: Date.now(),

    asset: t.asset,
    from: t.from,
    to: t.to,
    from_formatted: t.fromFormatted,
    to_formatted: t.toFormatted,
    amount: t.amount,

    decimals: t.decimals,
    symbol: t.symbol,
    usd: t.volume,

    tx_primary: txHash,
    tx_secondary: evmTxHash,

    event: asJSON(t.event),
    transaction: t.extrinsic ? asJSON(t.extrinsic) : '{}',
  }
}

export function resolveEvmToSubstratePubKey(evmAddress: HexString): HexString {
  const hex = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress
  const addressBuf = Buffer.from(hex, 'hex')

  const asciiPrefix = addressBuf.subarray(0, 4).toString('ascii')
  if (asciiPrefix === 'modl' && addressBuf.length === 20) {
    const buf = Buffer.alloc(32)
    addressBuf.copy(buf, 0)
    return toHex(buf) as HexString
  }

  return toHex(padAccountKey20(`0x${hex}`)) as HexString
}

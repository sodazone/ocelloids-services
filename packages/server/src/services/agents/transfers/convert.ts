import { Twox256 } from '@polkadot-api/substrate-bindings'
import { fromHex, toHex } from 'polkadot-api/utils'
import { asJSON, deepCamelize, stringToUa8 } from '@/common/util.js'
import { BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { IcTransfer, IcTransferResponse, NewIcTransfer } from './repositories/types.js'
import { EnrichedTransfer } from './types.js'

export function isSystemAccount(address: Buffer | HexString) {
  const addressBuf = typeof address === 'string' ? Buffer.from(address.slice(2), 'hex') : address
  const asciiPrefix = addressBuf.subarray(0, 4).toString('ascii')
  return asciiPrefix === 'modl'
}

export function mapRowToTransferResponse(row: IcTransfer): IcTransferResponse {
  const response = {
    ...row,
    transfer_hash: toHex(row.transfer_hash),
    block_hash: toHex(row.block_hash),
    tx_primary: row.tx_primary ? toHex(row.tx_primary) : undefined,
    tx_secondary: row.tx_secondary ? toHex(row.tx_secondary) : undefined,
  }

  return deepCamelize(response)
}

export function toTransferHash(t: EnrichedTransfer): Uint8Array {
  return Twox256(stringToUa8(`${t.chainId}|${t.blockNumber}|${t.from}|${t.to}|${t.asset}|${t.amount}`))
}

export function mapTransferToRow(t: EnrichedTransfer): NewIcTransfer {
  const tx = t.extrinsic ? (t.extrinsic as BlockExtrinsic) : undefined
  const blockPosition = t.event.blockPosition
  const txHash = tx?.hash ? fromHex(tx.hash) : undefined
  const evmTxHash = tx?.evmTxHash ? fromHex(tx.evmTxHash) : undefined

  return {
    type: t.type,
    transfer_hash: toTransferHash(t),
    network: t.chainId,
    block_number: t.blockNumber,
    block_hash: fromHex(t.blockHash),
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
    transaction: tx
      ? asJSON({
          index: tx.blockPosition,
          module: tx.module,
          method: tx.method,
          signer: tx.address,
        })
      : '{}',
  }
}

export function resolveEvmToSubstratePubKey(evmAddress: HexString): HexString {
  const hex = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress
  const addressBuf = Buffer.from(hex, 'hex')

  if (isSystemAccount(addressBuf) && addressBuf.length === 20) {
    const buf = Buffer.alloc(32)
    addressBuf.copy(buf, 0)
    return toHex(buf) as HexString
  }

  return evmAddress
}

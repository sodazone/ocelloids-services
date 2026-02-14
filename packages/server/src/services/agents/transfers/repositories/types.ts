import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import { IcTransferType } from '../types.js'

/**
 * Intra-chain transfers table
 *
 * @internal
 */
export interface IcTransferTable {
  id: Generated<number>
  transfer_hash: ColumnType<Uint8Array>
  type: ColumnType<IcTransferType>

  network: ColumnType<string>
  block_number: ColumnType<string>
  block_hash: ColumnType<Uint8Array>

  from: ColumnType<string>
  to: ColumnType<string>
  from_formatted: ColumnType<string | undefined>
  to_formatted: ColumnType<string | undefined>

  sent_at: ColumnType<number, number | undefined, never>
  created_at: ColumnType<number, number | undefined, never>

  event_index: ColumnType<number>
  event_module: ColumnType<string>
  event_name: ColumnType<string>

  tx_primary: ColumnType<Uint8Array | undefined>
  tx_secondary: ColumnType<Uint8Array | undefined>
  tx_index: ColumnType<number | undefined>
  tx_module: ColumnType<string | undefined>
  tx_method: ColumnType<string | undefined>
  tx_signer: ColumnType<Uint8Array | undefined>

  asset: ColumnType<string>
  symbol: ColumnType<string | undefined>
  amount: ColumnType<string>
  decimals: ColumnType<number | undefined>
  usd: ColumnType<number | undefined>
}

/**
 * @internal
 */
export type IcTransfer = Selectable<IcTransferTable>
export type NewIcTransfer = Insertable<IcTransferTable>
export type IcTransferUpdate = Updateable<IcTransferTable>

/**
 * @internal
 */
export interface IcAssetSnapshotTable {
  asset: string
  symbol?: string
  usd_volume: number
  snapshot_start: number
  snapshot_end: number
}

/**
 * @internal
 */
export type IcAssetSnapshot = Selectable<IcAssetSnapshotTable>
export type NewIcAssetSnapshot = Insertable<IcAssetSnapshotTable>
export type IcAssetSnapshotUpdate = Updateable<IcAssetSnapshotTable>

export interface IntrachainTransfersDatabase {
  ic_transfers: IcTransferTable
  ic_asset_volume_cache: IcAssetSnapshotTable
}

/**
 * @public
 */
export type IcTransferResponse = {
  id: number
  transferHash: string
  type: IcTransferType

  network: string
  blockNumber: string
  blockHash: string

  from: string
  to: string
  fromFormatted: string | undefined
  toFormatted: string | undefined

  sentAt: number
  createdAt: number

  eventIndex: number
  eventModule: string
  eventName: string

  txPrimary: string | undefined
  txSecondary: string | undefined
  txIndex: number | undefined
  txModule: string | undefined
  txMethod: string | undefined
  txSigner: string | undefined

  asset: string
  symbol: string | undefined
  amount: string
  decimals: number | undefined
  usd: number | undefined
}

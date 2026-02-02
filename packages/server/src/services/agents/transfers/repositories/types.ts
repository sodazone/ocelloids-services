import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

/**
 * Intra-chain transfers table
 *
 * @internal
 */
export interface IcTransferTable {
  id: Generated<number>
  transfer_hash: ColumnType<string>

  network: ColumnType<string>
  block_number: ColumnType<string>
  block_hash: ColumnType<string>
  event_index: ColumnType<number>

  from: ColumnType<string>
  to: ColumnType<string>
  from_formatted: ColumnType<string | undefined>
  to_formatted: ColumnType<string | undefined>

  sent_at: ColumnType<number, number | undefined, never>
  created_at: ColumnType<number, number, never>

  event: JSONColumnType<any>
  transaction: JSONColumnType<any>
  tx_primary: ColumnType<string | undefined>
  tx_secondary: ColumnType<string | undefined>

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

export interface IntrachainTransfersDatabase {
  ic_transfers: IcTransferTable
}

/**
 * @public
 */
export type IcTransferResponse = {
  id: number
  transferHash: string

  network: string
  blockNumber: string
  blockHash: string
  eventIndex: number

  from: string
  to: string
  fromFormatted: string | undefined
  toFormatted: string | undefined

  sentAt: number
  createdAt: number

  event: any
  transaction: any
  txPrimary: string | undefined
  txSecondary: string | undefined

  asset: string
  symbol: string | undefined
  amount: string
  decimals: number | undefined
  usd: number | undefined
}

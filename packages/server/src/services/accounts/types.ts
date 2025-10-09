import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export interface AccountTable {
  id: Generated<number>
  subject: ColumnType<string>
  status: 'enabled' | 'disabled'
  created_at: ColumnType<Date, string | undefined, never>
}

export type Account = Selectable<AccountTable>
export type NewAccount = Insertable<AccountTable>
export type AccountUpdate = Updateable<AccountTable>
export type AccountWithCaps = Omit<Account, 'created_at'> & {
  caps: string[]
}

export interface ApiTokenTable {
  id: ColumnType<string>
  account_id: number
  name: ColumnType<string | undefined>
  scope: ColumnType<string>
  status: 'enabled' | 'disabled'
  created_at: ColumnType<Date, string | undefined, never>
}

export type ApiToken = Selectable<ApiTokenTable>
export type NewApiToken = Insertable<ApiTokenTable>
export type ApiTokenUpdate = Updateable<ApiTokenTable>

export interface Database {
  account: AccountTable
  ['api-token']: ApiTokenTable
}

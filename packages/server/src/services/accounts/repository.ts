import { AccountUpdate, Database, NewAccount } from '@/services/persistence/kysely/database/types.js'
import { Expression, Kysely } from 'kysely'

import { jsonArrayFrom } from 'kysely/helpers/sqlite'

export class AccountsRepository {
  readonly #db: Kysely<Database>

  constructor(db: Kysely<Database>) {
    this.#db = db
  }

  async updateAccount(id: number, updateWith: AccountUpdate) {
    await this.#db.updateTable('account').set(updateWith).where('id', '=', id).execute()
  }

  async createAccount(account: NewAccount) {
    return await this.#db.insertInto('account').values(account).returningAll().executeTakeFirstOrThrow()
  }

  async deleteAccount(id: number) {
    return await this.#db.deleteFrom('account').where('id', '=', id).returningAll().executeTakeFirst()
  }

  async findAccountById(id: number) {
    return await this.#db
      .selectFrom('account')
      .where('id', '=', id)
      .selectAll('account')
      .select(({ ref }) => [this.#apiTokens(ref('account.id')).as('api_tokens')])
      .executeTakeFirst()
  }

  #apiTokens(accountId: Expression<number>) {
    return jsonArrayFrom(
      this.#db
        .selectFrom('api-token')
        .select(['api-token.id', 'api-token.token'])
        .where('api-token.account_id', '=', accountId)
        .orderBy('api-token.name'),
    )
  }
}

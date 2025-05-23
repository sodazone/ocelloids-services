import { Expression, Kysely } from 'kysely'

import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'

import {
  AccountUpdate,
  ApiTokenUpdate,
  Database,
  NewAccount,
  NewApiToken,
} from '@/services/accounts/types.js'

export class AccountsRepository {
  readonly #db: Kysely<Database>

  constructor(db: Kysely<Database>) {
    this.#db = db
  }

  async updateAccount(id: number, updateWith: AccountUpdate) {
    await this.#db.updateTable('account').set(updateWith).where('id', '=', id).execute()
  }

  async createAccount(account: NewAccount) {
    // TODO sanitize subject
    return await this.#db.insertInto('account').values(account).returningAll().executeTakeFirstOrThrow()
  }

  async deleteAccount(id: number) {
    return await this.#db.deleteFrom('account').where('id', '=', id).returningAll().executeTakeFirst()
  }

  async deleteAccountBySubject(subject: string) {
    return await this.#db
      .deleteFrom('account')
      .where('subject', '=', subject)
      .returningAll()
      .executeTakeFirst()
  }

  async createApiToken(apiToken: NewApiToken) {
    return await this.#db.insertInto('api-token').values(apiToken).returningAll().executeTakeFirstOrThrow()
  }

  async updateApiToken(id: string, updateWith: ApiTokenUpdate) {
    return await this.#db.updateTable('api-token').set(updateWith).where('id', '=', id).execute()
  }

  async findApiTokenById(id: string) {
    return await this.#db
      .selectFrom('api-token')
      .where('id', '=', id)
      .selectAll('api-token')
      .select(({ ref }) => [this.#account(ref('api-token.account_id')).$notNull().as('account')])
      .executeTakeFirst()
  }

  async findApiTokensByAccount(accountId: number) {
    return await this.#db.selectFrom('api-token').where('account_id', '=', accountId).selectAll().execute()
  }

  async findApiTokenByAccount(accountId: number, tokenId: string) {
    return await this.#db
      .selectFrom('api-token')
      .where('id', '=', tokenId)
      .where('account_id', '=', accountId)
      .selectAll()
      .executeTakeFirst()
  }

  async deleteApiToken(id: string) {
    return await this.#db.deleteFrom('api-token').where('id', '=', id).returningAll().executeTakeFirst()
  }

  async findAccountBySubject(subject: string) {
    return await this.#db
      .selectFrom('account')
      .where('subject', '=', subject)
      .selectAll('account')
      .select(({ ref }) => [this.#apiTokens(ref('account.id')).as('api_tokens')])
      .executeTakeFirst()
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
        .select(['api-token.id', 'api-token.status', 'api-token.scope'])
        .where('api-token.account_id', '=', accountId)
        .orderBy('api-token.name'),
    )
  }

  #account(accountId: Expression<number>) {
    return jsonObjectFrom(
      this.#db
        .selectFrom('account')
        .select(['account.id', 'account.status', 'account.subject', 'account.created_at'])
        .where('account.id', '=', accountId),
    )
  }
}

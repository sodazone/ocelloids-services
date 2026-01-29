import { Kysely } from 'kysely'
import { IcTransfer, IntrachainTransfersDatabase, NewIcTransfer } from './types.js'

export class IntrachainTransfersRepository {
  readonly #db: Kysely<IntrachainTransfersDatabase>

  constructor(db: Kysely<IntrachainTransfersDatabase>) {
    this.#db = db
  }

  async insertTransfer(transfer: NewIcTransfer): Promise<IcTransfer> {
    const inserted = await this.#db
      .insertInto('ic_transfers')
      .values(transfer)
      .returningAll()
      .executeTakeFirst()

    if (!inserted) {
      throw new Error('Failed to insert transfer')
    }

    return inserted
  }
}

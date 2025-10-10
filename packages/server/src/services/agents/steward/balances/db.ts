import { HexString } from '@/lib.js'
import { BatchOperation, LevelDB } from '@/services/types.js'
import { createBalancesCodec, normaliseAddress } from './codec.js'

const DISCO_MARKER_BYTE = Buffer.from([0xff])

function epochSecondsNow() {
  return Math.trunc(Date.now() / 1_000)
}

export type BalanceRecord = {
  accountHex: HexString
  assetKeyHash: HexString
  balance: bigint | null
}

export class BalancesDB {
  readonly #db: LevelDB<Buffer, Buffer>
  readonly #codec = createBalancesCodec()

  constructor(db: LevelDB<Buffer, Buffer>) {
    this.#db = db
  }

  async putBatch(records: BalanceRecord[]): Promise<void> {
    if (!records || records.length === 0) {
      return
    }

    const ops: BatchOperation<Buffer, Buffer>[] = []

    for (const { accountHex, assetKeyHash, balance } of records) {
      const key = this.#codec.key.enc(accountHex, assetKeyHash)

      if (balance !== null) {
        const value = this.#codec.value.enc(balance, epochSecondsNow())
        ops.push({ type: 'put', key, value })
      } else {
        ops.push({ type: 'del', key })
      }
    }

    if (ops.length > 0) {
      await this.#db.batch(ops)
    }
  }

  async markDiscovered(account: HexString): Promise<void> {
    const key = Buffer.concat([DISCO_MARKER_BYTE, normaliseAddress(account)])
    await this.#db.put(key, Buffer.from([1]))
  }

  async hasBeenDiscovered(account: HexString): Promise<boolean> {
    const key = Buffer.concat([DISCO_MARKER_BYTE, normaliseAddress(account)])
    try {
      return (await this.#db.get(key)) !== undefined
    } catch {
      return false
    }
  }

  async *iterateAccountBalances(accountHex: HexString) {
    const prefix = normaliseAddress(accountHex) // 32 bytes
    const start = Buffer.from(prefix)
    let end = Buffer.from(prefix)
    // increment last byte to create an upper bound for the prefix
    for (let i = end.length - 1; i >= 0; i--) {
      if (end[i] < 0xff) {
        end[i]++
        end = end.subarray(0, i + 1)
        break
      }
    }

    const iterator = this.#db.iterator({
      gte: start,
      lt: end,
    })

    for await (const [keyBuf, valueBuf] of iterator) {
      const { addressHex, assetIdHex } = this.#codec.key.dec(keyBuf)
      const { balance, epochSeconds } = this.#codec.value.dec(valueBuf)
      yield { addressHex, assetIdHex, balance, epochSeconds }
    }
  }

  async close() {
    await this.#db.close()
  }
}

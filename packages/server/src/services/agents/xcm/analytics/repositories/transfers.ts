import { DuckDBConnection, DuckDBTimestampMillisecondsValue, DuckDBTimestampValue } from '@duckdb/node-api'
import { NewXcmTransfer } from '../types.js'

type INTERVALS = '10m' | '30m' | '1h' | '1d'

const createTransfersSeqSql = `
CREATE SEQUENCE IF NOT EXISTS seq_transfers START 1;
`.trim()

const createTransfersTableSql = `
CREATE TABLE IF NOT EXISTS transfers(
  id INTEGER PRIMARY KEY,
  correlation_id STRING NOT NULL,
  recv_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  asset STRING NOT NULL,
  symbol STRING NOT NULL,
  decimals INTEGER NOT NULL,
  amount UHUGEINT NOT NULL,
  origin STRING NOT NULL,
  destination STRING NOT NULL,
  from_address STRING NOT NULL,
  to_address STRING NOT NULL
);
`.trim()

const insertTransferPSql = `
INSERT INTO 
transfers VALUES (
  nextval('seq_transfers'),
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11
);
`.trim()

function multiplyInterval(interval: string, times = 2) {
  const parsedInterval = interval.match(/^(\d+)([a-z]+)$/i)
  if (!parsedInterval) {
    throw new Error('Invalid interval format')
  }

  const [_, value, unit] = parsedInterval
  return `${parseInt(value) * times} ${unit}`
}

export class XcmTransfersRepository {
  readonly #db: DuckDBConnection

  constructor(db: DuckDBConnection) {
    this.#db = db
  }

  async migrate() {
    await this.#db.run(createTransfersSeqSql)
    return await this.#db.run(createTransfersTableSql)
  }

  async insert(t: NewXcmTransfer) {
    let id = 1
    const p = await this.#db.prepare(insertTransferPSql)
    p.bindVarchar(id++, t.correlationId)
    p.bindTimestampMilliseconds(id++, new DuckDBTimestampMillisecondsValue(BigInt(t.sentAt)))
    p.bindTimestampMilliseconds(id++, new DuckDBTimestampMillisecondsValue(BigInt(t.recvAt)))
    p.bindVarchar(id++, t.asset)
    p.bindVarchar(id++, t.symbol)
    p.bindSmallInt(id++, t.decimals)
    p.bindUHugeInt(id++, t.amount)
    p.bindVarchar(id++, t.origin)
    p.bindVarchar(id++, t.destination)
    p.bindVarchar(id++, t.from)
    p.bindVarchar(id, t.to)
    return await p.run()
  }

  async totalTransfers(interval: INTERVALS = '1h') {
    const query = `
      WITH periods AS (
        SELECT 
          COUNT(*) AS current_period_count,
          (SELECT COUNT(*) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${multiplyInterval(interval, 2)}' AND NOW() - INTERVAL '${interval}') AS previous_period_count
        FROM transfers
        WHERE sent_at > NOW() - INTERVAL '${interval}'
      )
      SELECT 
        current_period_count,
        previous_period_count,
        current_period_count - previous_period_count AS diff
      FROM periods;
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()

    return rows.map((row) => {
      return {
        current: Number(row[0] as bigint),
        previous: Number(row[1] as bigint),
        diff: Number(row[2] as bigint),
      }
    })
  }

  async transfers(interval: INTERVALS = '10m') {
    const query = `
      SELECT
        time_bucket(INTERVAL '${interval}', sent_at) AS time_range,
        COUNT(*) AS txs
      FROM transfers
      GROUP BY time_range
      ORDER BY time_range;
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()

    return rows.map((row) => {
      const timestamp = (row[0] as DuckDBTimestampValue).toString()

      return {
        time: Math.floor(new Date(timestamp).getTime() / 1000), //  UNIX seconds
        value: Number(row[1] as bigint),
      }
    })
  }

  async amountBySymbol(interval: INTERVALS = '1h') {
    const query = `
      SELECT
        time_bucket(INTERVAL '${interval}', sent_at) AS time_range,
        ARBITRARY(symbol) AS symbol,
        SUM(amount) AS amount_bint,
        SUM(amount) / POWER(10, ARBITRARY(decimals)) AS amount_dec
      FROM transfers
      GROUP BY time_range, symbol
      ORDER BY time_range;
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()

    return rows.map((row) => {
      const timestamp = (row[0] as DuckDBTimestampValue).toString()

      return {
        time: Math.floor(new Date(timestamp).getTime() / 1000), //  UNIX seconds
        symbol: row[1] as string,
        value: row[3] as number,
      }
    })
  }

  async all() {
    return (await this.#db.run('SELECT * FROM transfers')).getRowsJson()
  }

  close() {
    this.#db.close()
  }
}

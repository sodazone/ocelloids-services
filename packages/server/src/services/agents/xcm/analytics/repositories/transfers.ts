import { DuckDBArrayValue, DuckDBConnection, DuckDBTimestampValue } from '@duckdb/node-api'
import { NewXcmTransfer, TimeSelect } from '../types.js'

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

function multiplyInterval(interval: string, times = 2) {
  const parsedInterval = interval.match(/^(\d+)\s?([a-z]+)$/i)
  if (!parsedInterval) {
    throw new Error('Invalid interval format')
  }

  const [_, value, unit] = parsedInterval
  return `${parseInt(value) * times} ${unit}`
}

const SAFE_STRING = /^[A-Za-z0-9 ]+$/
function safe(s: string) {
  if (SAFE_STRING.test(s)) {
    return s
  }
  throw new Error('unsafe string')
}

// (!) Security NOTE
// Neo DuckDB does not manage properly the prepared statements right now,
// causing "invalid: free()" crashes.
// So, we cannot rely on prepared query statements for the moment :/
export class XcmTransfersRepository {
  readonly #db: DuckDBConnection

  constructor(db: DuckDBConnection) {
    this.#db = db
  }

  async migrate() {
    await this.#db.run(createTransfersSeqSql)
    await this.#db.run(createTransfersTableSql)
  }

  async insert(t: NewXcmTransfer) {
    return await this.#db.run(
      `
    INSERT INTO 
    transfers VALUES (
      nextval('seq_transfers'),
      '${t.correlationId}',
      epoch_ms(${t.recvAt}),
      epoch_ms(${t.sentAt}),
      '${t.asset.replaceAll(/['\\]/g, '')}',
      '${t.symbol}',
      ${t.decimals},
      ${t.amount}::HUGEINT,
      '${t.origin}',
      '${t.destination}',
      '${t.from}',
      '${t.to}'
    );
    `.trim(),
    )
  }

  async totalTransfers(criteria: TimeSelect) {
    const interval = safe(criteria.timeframe)
    const intervalMax = safe(multiplyInterval(interval, 2))
    const query = `
      WITH periods AS (
        SELECT 
          COUNT(*) AS current_period_count,
          (SELECT COUNT(*) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_period_count,
          
          COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) AS current_unique_accounts,
          (SELECT COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_unique_accounts,
  
          AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) AS current_avg_time,
          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_avg_time
        FROM transfers
        WHERE sent_at > NOW() - INTERVAL '${interval}'
      )
      SELECT 
        current_period_count,
        previous_period_count,
        current_period_count - previous_period_count AS diff,
  
        current_unique_accounts,
        previous_unique_accounts,
        current_unique_accounts - previous_unique_accounts AS diff_accounts,
  
        current_avg_time,
        previous_avg_time,
        current_avg_time - previous_avg_time AS diff_avg_time
      FROM periods;
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()

    return rows.map((row) => ({
      current: Number(row[0] as bigint),
      previous: Number(row[1] as bigint),
      diff: Number(row[2] as bigint),

      accounts: {
        current: Number(row[3] as bigint),
        previous: Number(row[4] as bigint),
        diff: Number(row[5] as bigint),
      },

      avgTimeSpent: {
        current: Number(row[6] as number),
        previous: Number(row[7] as number),
        diff: Number(row[8] as number),
      },
    }))
  }

  async all() {
    return (await this.#db.run('SELECT * FROM transfers')).getRows()
  }

  async getAggregatedData(criteria: TimeSelect, metric: 'txs' | 'volumeByAsset' | 'transfersByChannel') {
    const bucketInterval = criteria.bucket ?? '1h'
    const timeframe = criteria.timeframe

    let query = ''
    if (metric === 'txs') {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
          COUNT(*) AS tx_count
        FROM transfers
        WHERE sent_at >= CURRENT_TIMESTAMP - INTERVAL '${safe(timeframe)}'
        GROUP BY time_range
        ORDER BY time_range;
      `
    } else if (metric === 'volumeByAsset') {
      query = `
        WITH aggregated AS (
          SELECT
            t.asset,
            ARBITRARY(t.symbol) AS symbol,
            time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
            COUNT(*) AS tx_count,
            SUM(t.amount) / POWER(10, ARBITRARY(t.decimals)) AS volume,
            ARRAY_AGG(DISTINCT t.origin) AS origins,
            ARRAY_AGG(DISTINCT t.destination) AS destinations
          FROM transfers t
          WHERE t.sent_at >= NOW() - INTERVAL '${safe(timeframe)}'
          GROUP BY t.asset, t.symbol, time_range
          ORDER BY volume DESC
        )
        SELECT
          a.time_range,
          a.asset,
          a.symbol,
          a.tx_count,
          a.volume,
          a.origins,
          a.destinations
        FROM aggregated a;
      `
    } else if (metric === 'transfersByChannel') {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
          origin,
          destination,
          COUNT(*) AS tx_count,
          SUM(amount) / POWER(10, ARBITRARY(decimals)) AS volume
        FROM transfers
        WHERE sent_at >= CURRENT_TIMESTAMP - INTERVAL '${safe(timeframe)}'
        GROUP BY time_range, origin, destination
        ORDER BY tx_count DESC;
      `
    }

    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()

    if (metric === 'txs') {
      return rows.map((row) => ({
        time: Math.floor(new Date((row[0] as DuckDBTimestampValue).toString()).getTime() / 1000),
        value: Number(row[1]),
      }))
    }

    type Data = {
      key: string
      total: number
      volume: number
      percentage: number
      series: { time: number; value: number }[]
    }
    const data: Record<string, Data | (Data & { symbol: string; networks: string[] })> = {}
    let grandTotal = 0

    for (const row of rows) {
      const time = Math.floor(new Date((row[0] as DuckDBTimestampValue).toString()).getTime() / 1000)
      const key = metric === 'volumeByAsset' ? (row[1] as string) : `${row[1]}-${row[2]}`
      const txs = Number(row[3])
      const volume = Number(row[4])

      if (!data[key]) {
        data[key] =
          metric === 'volumeByAsset'
            ? { key, symbol: row[2] as string, networks: [], total: 0, volume: 0, percentage: 0, series: [] }
            : { key, total: 0, percentage: 0, volume: 0, series: [] }
      }

      data[key].total += txs
      data[key].volume += volume
      grandTotal += txs
      data[key].series.push({ time, value: txs })

      if (metric === 'volumeByAsset') {
        const origins = (row[5] as DuckDBArrayValue).items as string[]
        const destinations = (row[6] as DuckDBArrayValue).items as string[]
        const allNetworks = [...origins, ...destinations]

        allNetworks.forEach((network) => {
          const d = data[key] as Data & { networks: string[] }
          if (!d.networks.includes(network)) {
            d.networks.push(network)
          }
        })
      }
    }

    for (const key in data) {
      data[key].percentage = (data[key].total / grandTotal) * 100
    }

    const dataArray = Object.values(data)
    dataArray.sort((a, b) => b.total - a.total)

    return dataArray
  }

  async transfers(criteria: TimeSelect) {
    return this.getAggregatedData(criteria, 'txs')
  }

  async volumeByAsset(criteria: TimeSelect) {
    return this.getAggregatedData(criteria, 'volumeByAsset')
  }

  async transfersByChannel(criteria: TimeSelect) {
    return this.getAggregatedData(criteria, 'transfersByChannel')
  }

  close() {
    this.#db.close()
  }
}

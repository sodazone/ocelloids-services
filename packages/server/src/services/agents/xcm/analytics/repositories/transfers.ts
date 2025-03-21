import {
  DuckDBArrayValue,
  DuckDBConnection,
  DuckDBTimestampMillisecondsValue,
  DuckDBTimestampValue,
} from '@duckdb/node-api'
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
  const parsedInterval = interval.match(/^(\d+)\s?([a-z]+)$/i)
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
    p.bindTimestampMilliseconds(id++, new DuckDBTimestampMillisecondsValue(BigInt(t.recvAt)))
    p.bindTimestampMilliseconds(id++, new DuckDBTimestampMillisecondsValue(BigInt(t.sentAt)))
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

  async totalTransfers(criteria: TimeSelect) {
    const interval = criteria.timeframe
    const query = `
      WITH periods AS (
        SELECT 
          COUNT(*) AS current_period_count,
          (SELECT COUNT(*) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${multiplyInterval(interval, 2)}' AND NOW() - INTERVAL '${interval}') AS previous_period_count,
          
          COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) AS current_unique_accounts,
          (SELECT COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${multiplyInterval(interval, 2)}' AND NOW() - INTERVAL '${interval}') AS previous_unique_accounts,
  
          AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) AS current_avg_time,
          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${multiplyInterval(interval, 2)}' AND NOW() - INTERVAL '${interval}') AS previous_avg_time
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
    return (await this.#db.run('SELECT * FROM transfers')).getRowsJson()
  }

  async getAggregatedData(
    criteria: TimeSelect,
    metric: 'txs' | 'amountByAsset' | 'amountByChannel',
    filterAsset?: string,
    filterChannel?: { origin: string; destination: string },
    sortBy?: 'highest' | 'lowest',
  ) {
    const bucketInterval = criteria.bucket ?? '1h'

    let query = ''
    if (metric === 'txs') {
      query = `
        SELECT
          time_bucket(INTERVAL '${bucketInterval}', sent_at) AS time_range,
          COUNT(*) AS value
        FROM transfers
        WHERE sent_at >= CURRENT_TIMESTAMP - INTERVAL '${criteria.timeframe}'
        ${filterChannel ? `AND origin = '${filterChannel.origin}' AND destination = '${filterChannel.destination}'` : ''}
        GROUP BY time_range
        ORDER BY time_range;
      `
    } else if (metric === 'amountByAsset') {
      query = `
WITH aggregated AS (
  SELECT
    t.asset,
    ARBITRARY(t.symbol) AS symbol,
    time_bucket(INTERVAL '${bucketInterval}', t.sent_at) AS time_range,
    COUNT(*) AS tx_count,
    SUM(t.amount) / POWER(10, ARBITRARY(t.decimals)) AS volume,
    ARRAY_AGG(DISTINCT t.origin) AS origins,
    ARRAY_AGG(DISTINCT t.destination) AS destinations
  FROM transfers t
  WHERE t.sent_at >= NOW() - INTERVAL '${criteria.timeframe}'
  ${filterAsset ? `AND t.asset = '${filterAsset}'` : ''}
  ${filterChannel ? `AND t.origin = '${filterChannel.origin}' AND t.destination = '${filterChannel.destination}'` : ''}
  GROUP BY t.asset, t.symbol, time_range
)
SELECT
  a.time_range,
  a.asset,
  a.symbol,
  a.tx_count,
  a.volume,
  a.origins,
  a.destinations
FROM aggregated a
ORDER BY a.time_range;
      `
    } else if (metric === 'amountByChannel') {
      query = `
        SELECT
          time_bucket(INTERVAL '${bucketInterval}', sent_at) AS time_range,
          origin,
          destination,
          COUNT(*) AS tx_count,
          SUM(amount) / POWER(10, ARBITRARY(decimals)) AS value
        FROM transfers
        WHERE sent_at >= CURRENT_TIMESTAMP - INTERVAL '${criteria.timeframe}'
        ${filterAsset ? `AND symbol = '${filterAsset}'` : ''}
        GROUP BY time_range, origin, destination
        ORDER BY time_range;
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

    // Aggregate data per asset or channel
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
      const key = metric === 'amountByAsset' ? (row[1] as string) : `${row[1]}-${row[2]}`
      const value = Number(row[3])
      const volume = Number(row[4])

      if (!data[key]) {
        data[key] =
          metric === 'amountByAsset'
            ? { key, symbol: row[2] as string, networks: [], total: 0, volume: 0, percentage: 0, series: [] }
            : { key, total: 0, percentage: 0, volume: 0, series: [] }
      }

      data[key].total += value
      data[key].volume += volume
      grandTotal += value
      data[key].series.push({ time, value })

      if (metric === 'amountByAsset') {
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

    // Calculate relative percentages
    for (const key in data) {
      data[key].percentage = (data[key].total / grandTotal) * 100
    }

    // Convert to an array and sort if needed
    const dataArray = Object.values(data)
    if (sortBy === 'highest') {
      dataArray.sort((a, b) => b.total - a.total)
    } else if (sortBy === 'lowest') {
      dataArray.sort((a, b) => a.total - b.total)
    }

    return dataArray
  }

  // Wrapper functions
  async transfers(criteria: TimeSelect, filterChannel?: { origin: string; destination: string }) {
    return this.getAggregatedData(criteria, 'txs', undefined, filterChannel)
  }

  async amountByAsset(
    criteria: TimeSelect,
    filterAsset?: string,
    filterChannel?: { origin: string; destination: string },
    sortBy?: 'highest' | 'lowest',
  ) {
    return this.getAggregatedData(criteria, 'amountByAsset', filterAsset, filterChannel, sortBy)
  }

  async amountByChannel(criteria: TimeSelect, filterAsset?: string, sortBy?: 'highest' | 'lowest') {
    return this.getAggregatedData(criteria, 'amountByChannel', filterAsset, undefined, sortBy)
  }

  close() {
    this.#db.close()
  }
}

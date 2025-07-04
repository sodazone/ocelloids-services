import { fromDuckDBBlob, toDuckDBHex, toSafeAsciiText, toSqlText } from '@/common/util.js'
import {
  DuckDBArrayValue,
  DuckDBBlobValue,
  DuckDBConnection,
  DuckDBDecimalValue,
  DuckDBTimestampValue,
} from '@duckdb/node-api'
import { TimeSelect } from '../../types/index.js'
import { NewXcmTransfer } from '../types.js'

export type AggregatedData = {
  key: string
  total: number
  volume: number
  volumeUsd: number
  percentageTx: number
  percentageVol: number
  series: { time: number; value: number }[]
}

const createTransfersSeqSql = `
CREATE SEQUENCE IF NOT EXISTS seq_xcm_transfers START 1;
`.trim()

const createTransfersTableSql = `
CREATE TABLE IF NOT EXISTS xcm_transfers(
  id INTEGER PRIMARY KEY,
  correlation_id BLOB NOT NULL,
  recv_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  asset BLOB NOT NULL,
  symbol STRING NOT NULL,
  decimals INTEGER NOT NULL,
  amount UHUGEINT NOT NULL,
  origin STRING NOT NULL,
  destination STRING NOT NULL,
  from_address BLOB NOT NULL,
  to_address BLOB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  volume DECIMAL(18,4)
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

/**
 * This repository provides analytics for XCM transfers, aggregating transaction counts
 * and volumes by channels and assets. It enables querying transfer data efficiently
 * for reporting and analysis.
 *
 * > ⚠️ Security Note
 * > **Neo DuckDB does not properly manage prepared statements at the moment,
 * > causing "invalid: free()" crashes.**
 * > As a result, we cannot rely on prepared query statements for now.
 */
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
    xcm_transfers VALUES (
      nextval('seq_xcm_transfers'),
      ${toDuckDBHex(t.correlationId)},
      epoch_ms(${t.recvAt}),
      epoch_ms(${t.sentAt}),
      ${toDuckDBHex(t.asset)},
      ${toSqlText(t.symbol)},
      ${t.decimals},
      ${t.amount}::HUGEINT,
      ${toSafeAsciiText(t.origin)},
      ${toSafeAsciiText(t.destination)},
      ${toDuckDBHex(t.from)},
      ${toDuckDBHex(t.to)},
      NOW(),
      ${t.volume ? DuckDBDecimalValue.fromDouble(t.volume, 18, 4) : 'NULL'}
    );
    `.trim(),
    )
  }

  async totalTransfers(criteria: TimeSelect) {
    const interval = safe(criteria.timeframe)
    const intervalMax = safe(multiplyInterval(interval, 2))
    const query = `
      SELECT 
        COUNT(*) AS current_period_count,
        (SELECT COUNT(*) FROM xcm_transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_period_count,
        
        COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) AS current_unique_accounts,
        (SELECT COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) FROM xcm_transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_unique_accounts,

        AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) AS current_avg_time,
        (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM xcm_transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_avg_time,

        SUM(COALESCE(volume, 0)) AS current_volume_usd,
        (SELECT SUM(COALESCE(volume, 0)) FROM xcm_transfers WHERE sent_at BETWEEN NOW() - INTERVAL '${intervalMax}' AND NOW() - INTERVAL '${interval}') AS previous_volume_usd
      FROM xcm_transfers
      WHERE sent_at > NOW() - INTERVAL '${interval}';
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()

    return rows.map((row) => ({
      current: Number(row[0] as bigint),
      previous: Number(row[1] as bigint),
      diff: Number(row[0] as number) - Number(row[1] as number),

      accounts: {
        current: Number(row[2] as bigint),
        previous: Number(row[3] as bigint),
        diff: Number(row[2] as number) - Number(row[3] as number),
      },

      avgTimeSpent: {
        current: Number(row[4] as number),
        previous: Number(row[5] as number),
        diff: Number(row[4] as number) - Number(row[5] as number),
      },

      volumeUsd: {
        current: Number(row[6] as number),
        previous: Number(row[7] as number),
        diff: Number(row[6] as number) - Number(row[7] as number),
      },
    }))
  }

  async all() {
    return (await this.#db.run('SELECT * FROM xcm_transfers')).getRows()
  }

  async getAggregatedData(criteria: TimeSelect, metric: 'txs' | 'volumeByAsset' | 'transfersByChannel') {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe

    let query = ''
    const unit = getUnit(bucketInterval)
    if (metric === 'txs') {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
          COUNT(*) AS tx_count,
          SUM(COALESCE(volume, 0)) AS volume_usd
        FROM xcm_transfers
        WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
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
            ARRAY_AGG(DISTINCT t.destination) AS destinations,
            SUM(COALESCE(volume, 0)) AS volume_usd
          FROM xcm_transfers t
          WHERE t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
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
          a.destinations,
          a.volume_usd,
        FROM aggregated a;
      `
    } else if (metric === 'transfersByChannel') {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
          origin,
          destination,
          COUNT(*) AS tx_count,
          SUM(amount) / POWER(10, ARBITRARY(decimals)) AS volume,
          SUM(COALESCE(volume, 0)) AS volume_usd
        FROM xcm_transfers
        WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
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
        volumeUsd: Number(row[2]),
      }))
    }

    const data: Record<string, AggregatedData | (AggregatedData & { symbol: string; networks: string[] })> =
      {}
    let grandTotal = 0
    let volTotal = 0

    for (const row of rows) {
      const time = Math.floor(new Date((row[0] as DuckDBTimestampValue).toString()).getTime() / 1000)
      const key =
        metric === 'volumeByAsset' ? fromDuckDBBlob(row[1] as DuckDBBlobValue) : `${row[1]}-${row[2]}`
      const txs = Number(row[3])
      const volume = Number(row[4])
      const volumeUsd = metric === 'volumeByAsset' ? Number(row[7]) : Number(row[5])

      if (!data[key]) {
        data[key] =
          metric === 'volumeByAsset'
            ? {
                key,
                symbol: row[2] as string,
                networks: [],
                total: 0,
                volume: 0,
                volumeUsd: 0,
                percentageTx: 0,
                percentageVol: 0,
                series: [],
              }
            : { key, total: 0, percentageTx: 0, percentageVol: 0, volume: 0, volumeUsd: 0, series: [] }
      }

      data[key].total += txs
      data[key].volume += volume
      data[key].volumeUsd += volumeUsd
      grandTotal += txs
      volTotal += volumeUsd
      data[key].series.push({ time, value: txs })

      if (metric === 'volumeByAsset') {
        const origins = (row[5] as DuckDBArrayValue).items as string[]
        const destinations = (row[6] as DuckDBArrayValue).items as string[]
        const allNetworks = [...origins, ...destinations]

        allNetworks.forEach((network) => {
          const d = data[key] as AggregatedData & { networks: string[] }
          if (!d.networks.includes(network)) {
            d.networks.push(network)
          }
        })
      }
    }

    for (const key in data) {
      data[key].percentageTx = (data[key].total / grandTotal) * 100
      data[key].percentageVol = (data[key].volumeUsd / volTotal) * 100
    }

    const dataArray = Object.values(data)
    dataArray.sort((a, b) => b.total - a.total)

    return dataArray
  }

  async getVolumeByNetwork(criteria: TimeSelect) {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)

    const query = `
        WITH network_data AS (
          SELECT
            origin AS network,
            COUNT(*) AS tx_count,
            SUM(COALESCE(volume, 0)) AS volume_usd,
            0 AS inflow_usd,
            SUM(COALESCE(volume, 0)) AS outflow_usd
          FROM xcm_transfers
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          GROUP BY origin

          UNION ALL

          SELECT
            destination AS network,
            COUNT(*) AS tx_count,
            SUM(COALESCE(volume, 0)) AS volume_usd,
            SUM(COALESCE(volume, 0)) AS inflow_usd,
            0 AS outflow_usd
          FROM xcm_transfers
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          GROUP BY destination
        )
        SELECT
          network,
          SUM(tx_count) AS tx_count,
          SUM(volume_usd) AS volume_usd,
          SUM(inflow_usd) AS inflow_usd,
          SUM(outflow_usd) AS outflow_usd
        FROM network_data
        GROUP BY network
        ORDER BY volume_usd DESC;
      `
    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()
    return rows.map((row) => ({
      network: row[0],
      value: Number(row[1]),
      volumeUsd: Number(row[2]),
      volumeIn: Number(row[3]),
      volumeOut: Number(row[4]),
      netFlow: Number(row[3]) - Number(row[4]),
    }))
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

  async volumeByNetwork(criteria: TimeSelect) {
    return this.getVolumeByNetwork(criteria)
  }

  close() {
    this.#db.closeSync()
  }
}

function getUnit(bucketInterval: string) {
  if (bucketInterval.endsWith('hours')) {
    return 'hour'
  }
  if (bucketInterval.endsWith('days')) {
    return 'day'
  }
  if (bucketInterval.endsWith('minutes')) {
    return 'minute'
  }
  throw new Error(`unsupported unit ${bucketInterval}`)
}

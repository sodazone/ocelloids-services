import {
  DuckDBArrayValue,
  DuckDBBlobValue,
  DuckDBConnection,
  DuckDBDecimalValue,
  DuckDBTimestampValue,
  DuckDBValue,
} from '@duckdb/node-api'
import { fromDuckDBBlob, toDuckDBHex, toSafeAsciiText, toSqlText } from '@/common/util.js'
import { TimeAndMaybeNetworkSelect, TimeAndNetworkSelect, TimeSelect } from '../../types/index.js'
import { NewXcmTransfer } from '../types.js'

export type AggregatedData = {
  key: string
  total: number
  volumeUsd: number | null
  percentageTx: number
  percentageVol: number | null
  series: { time: number; value: number }[]
}

export type NetworkFlowData = {
  key: string
  total: number | null
  inflow: number | null
  outflow: number | null
  netflow: number | null
  series: { time: number; value: number }[]
}

export type NetworkAssetData = NetworkFlowData & {
  symbol: string
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
  volume DECIMAL(18,4),
  origin_protocol STRING NOT NULL,
  destination_protocol STRING NOT NULL,
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

    // Add columns if they don't exist
    await this.#db.run(`
      ALTER TABLE xcm_transfers ADD COLUMN IF NOT EXISTS origin_protocol STRING;
    `)
    await this.#db.run(`
      ALTER TABLE xcm_transfers ADD COLUMN IF NOT EXISTS destination_protocol STRING;
    `)

    // Backfill NULLs with 'xcm'
    await this.#db.run(`
      UPDATE xcm_transfers
      SET origin_protocol = 'xcm'
      WHERE origin_protocol IS NULL;
    `)
    await this.#db.run(`
      UPDATE xcm_transfers
      SET destination_protocol = 'xcm'
      WHERE destination_protocol IS NULL;
    `)
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
      ${t.volume ? DuckDBDecimalValue.fromDouble(t.volume, 18, 4) : 'NULL'},
      ${toSafeAsciiText(t.originProtocol)},
      ${toSafeAsciiText(t.destinationProtocol)},
    );
    `.trim(),
    )
  }

  async totalTransfers(criteria: TimeAndMaybeNetworkSelect) {
    if (criteria.network !== undefined) {
      return this.totalTransfersByNetwork(criteria as TimeAndNetworkSelect)
    }
    const interval = safe(criteria.timeframe)
    const intervalMax = safe(multiplyInterval(interval, 2))
    const unit = getUnit(criteria.bucket ?? '1 hours')
    const query = `
        WITH base AS (
          SELECT * FROM xcm_transfers
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${intervalMax}')
        ),
        current_period AS (
          SELECT *
          FROM base
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${intervalMax}')
        ),
        previous_period AS (
          SELECT *
          FROM base
          WHERE sent_at BETWEEN DATE_TRUNC('${unit}', NOW() - INTERVAL '${intervalMax}') AND DATE_TRUNC('${unit}', NOW() - INTERVAL '${interval}')
        )
        SELECT
          (SELECT COUNT(*) FROM current_period) AS current_period_count,
          (SELECT COUNT(*) FROM previous_period) AS previous_period_count,

          (SELECT COUNT(DISTINCT addr) FROM (
            SELECT from_address AS addr FROM current_period
            UNION
            SELECT to_address AS addr FROM current_period
          )) AS current_unique_accounts,
          (SELECT COUNT(DISTINCT addr) FROM (
            SELECT from_address AS addr FROM previous_period
            UNION
            SELECT to_address AS addr FROM previous_period
          )) AS previous_unique_accounts,

          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM current_period) AS current_avg_time,
          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM previous_period) AS previous_avg_time,

          (SELECT SUM(COALESCE(volume, 0)) FROM current_period) AS current_volume_usd,
          (SELECT SUM(COALESCE(volume, 0)) FROM previous_period) AS previous_volume_usd;
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

  async totalTransfersByNetwork(criteria: TimeAndNetworkSelect) {
    const interval = safe(criteria.timeframe)
    const intervalMax = safe(multiplyInterval(interval, 2))
    const unit = getUnit(criteria.bucket ?? '1 hours')
    const network = criteria.network

    const query = `
        WITH base AS (
          SELECT * FROM xcm_transfers
          WHERE (origin = '${network}' OR destination = '${network}')
            AND sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${intervalMax}')
        ),
        current_period AS (
          SELECT * FROM base
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${interval}')
        ),
        previous_period AS (
          SELECT * FROM base
          WHERE sent_at BETWEEN DATE_TRUNC('${unit}', NOW() - INTERVAL '${intervalMax}') AND DATE_TRUNC('${unit}', NOW() - INTERVAL '${interval}')
        )
        SELECT
          (SELECT COUNT(*) FROM current_period) AS current_period_count,
          (SELECT COUNT(*) FROM previous_period) AS previous_period_count,

          (SELECT COUNT(DISTINCT addr) FROM (
            SELECT from_address AS addr FROM current_period
            UNION
            SELECT to_address AS addr FROM current_period
          )) AS current_unique_accounts,
          (SELECT COUNT(DISTINCT addr) FROM (
            SELECT from_address AS addr FROM previous_period
            UNION
            SELECT to_address AS addr FROM previous_period
          )) AS previous_unique_accounts,

          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM current_period) AS current_avg_time,
          (SELECT AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) FROM previous_period) AS previous_avg_time,

          (SELECT SUM(COALESCE(volume, 0)) FROM current_period) AS current_volume_usd,
          (SELECT SUM(COALESCE(volume, 0)) FROM previous_period) AS previous_volume_usd;
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
            CASE
              WHEN ARBITRARY(t.symbol) != '' THEN
                SUM(t.amount) / POWER(10, ARBITRARY(t.decimals))
              ELSE NULL
            END AS volume,
            ARRAY_AGG(DISTINCT t.origin) AS origins,
            ARRAY_AGG(DISTINCT t.destination) AS destinations,
            CASE
              WHEN COUNT(volume) = 0 THEN NULL
              ELSE SUM(volume)
            END AS volume_usd
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
          CASE
            WHEN COUNT(volume) = 0 THEN NULL
            ELSE SUM(volume)
          END AS volume_usd
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

    const data: Record<
      string,
      AggregatedData | (AggregatedData & { symbol: string; volume: number | null; networks: string[] })
    > = {}
    let grandTotal = 0
    let volTotal = 0

    for (const row of rows) {
      const time = toUnix(row[0] as DuckDBTimestampValue)
      const key =
        metric === 'volumeByAsset' ? fromDuckDBBlob(row[1] as DuckDBBlobValue) : `${row[1]}-${row[2]}`
      const txs = Number(row[3])
      const volume = metric === 'volumeByAsset' ? toNullableNumber(row[4]) : null
      const volumeUsd = metric === 'volumeByAsset' ? toNullableNumber(row[7]) : toNullableNumber(row[4])

      if (!data[key]) {
        data[key] =
          metric === 'volumeByAsset'
            ? {
                key,
                symbol: row[2] as string,
                networks: [],
                total: 0,
                volume: null,
                volumeUsd: null,
                percentageTx: 0,
                percentageVol: null,
                series: [],
              }
            : { key, total: 0, percentageTx: 0, percentageVol: null, volumeUsd: null, series: [] }
      }

      data[key].total += txs
      if (volume !== null && 'volume' in data[key]) {
        data[key].volume = (data[key].volume ?? 0) + volume
      }
      if (volumeUsd !== null) {
        data[key].volumeUsd = (data[key].volumeUsd ?? 0) + volumeUsd
        volTotal += volumeUsd
      }

      grandTotal += txs
      data[key].series.push({ time, value: volumeUsd ?? 0 })

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
      data[key].percentageVol = data[key].volumeUsd !== null ? (data[key].volumeUsd / volTotal) * 100 : null
    }

    const dataArray = Object.values(data)
    dataArray.sort((a, b) => b.total - a.total)

    return dataArray
  }

  async volumeByNetwork(criteria: TimeSelect) {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)

    const query = `
        WITH network_data AS (
          SELECT
            origin AS network,
            COUNT(*) AS tx_count,
            SUM(volume) AS volume_usd,
            0 AS inflow_usd,
            SUM(volume) AS outflow_usd
          FROM xcm_transfers
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          GROUP BY origin

          UNION ALL

          SELECT
            destination AS network,
            COUNT(*) AS tx_count,
            SUM(volume) AS volume_usd,
            SUM(volume) AS inflow_usd,
            0 AS outflow_usd
          FROM xcm_transfers
          WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          GROUP BY destination
        )
        SELECT
          network,
          SUM(tx_count) AS tx_count,
          CASE WHEN COUNT(volume_usd) FILTER (WHERE volume_usd IS NOT NULL) = 0 THEN NULL ELSE SUM(volume_usd) END AS volume_usd,
          CASE WHEN COUNT(inflow_usd) FILTER (WHERE volume_usd IS NOT NULL) = 0 THEN NULL ELSE SUM(inflow_usd) END AS inflow_usd,
          CASE WHEN COUNT(outflow_usd) FILTER (WHERE volume_usd IS NOT NULL) = 0 THEN NULL ELSE SUM(outflow_usd) END AS outflow_usd
        FROM network_data
        GROUP BY network
        ORDER BY volume_usd DESC;
      `
    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()
    return rows.map((row) => {
      const volumeIn = toNullableNumber(row[3])
      const volumeOut = toNullableNumber(row[4])
      return {
        network: row[0],
        value: Number(row[1]),
        volumeUsd: toNullableNumber(row[2]),
        volumeIn,
        volumeOut,
        netflow: volumeIn !== null && volumeOut !== null ? volumeIn - volumeOut : null,
      }
    })
  }

  async networkVolumeSeries(criteria: TimeAndNetworkSelect) {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)
    const network = criteria.network

    const query = `
    WITH network_data AS (
      SELECT
        time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
        origin AS network,
        COUNT(*) AS tx_count,
        SUM(COALESCE(volume, 0)) AS outflow_usd,
        0 AS inflow_usd
      FROM xcm_transfers
      WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
      GROUP BY time_range, network

      UNION ALL

      SELECT
        time_bucket(INTERVAL '${safe(bucketInterval)}', sent_at) AS time_range,
        destination AS network,
        COUNT(*) AS tx_count,
        0 AS outflow_usd,
        SUM(COALESCE(volume, 0)) AS inflow_usd
      FROM xcm_transfers
      WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
      GROUP BY time_range, network
    ),

    aggregated AS (
      SELECT
        time_range,
        network,
        SUM(tx_count) AS tx_count,
        SUM(inflow_usd) AS inflow_usd,
        SUM(outflow_usd) AS outflow_usd,
        SUM(inflow_usd + outflow_usd) AS total_volume_usd
      FROM network_data
      GROUP BY time_range, network
    ),

    total_volume_per_bucket AS (
      SELECT
        time_range,
        SUM(total_volume_usd) AS bucket_total_volume
      FROM aggregated
      GROUP BY time_range
    )

    SELECT
      a.time_range,
      a.network,
      a.tx_count,
      a.inflow_usd,
      a.outflow_usd,
      a.total_volume_usd,
      t.bucket_total_volume,
      CASE WHEN t.bucket_total_volume > 0 THEN (a.total_volume_usd / t.bucket_total_volume) * 100 ELSE 0 END AS share_pct
    FROM aggregated a
    JOIN total_volume_per_bucket t ON a.time_range = t.time_range
    WHERE a.network = '${network}'
    ORDER BY a.time_range, network;
  `

    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()

    // Format output: grouped by time_range, each with network shares
    const series: Record<
      string,
      Array<{
        time: number
        txCount: number
        inflowUsd: number
        outflowUsd: number
        totalVolumeUsd: number
        sharePct: number
      }>
    > = {}

    for (const row of rows) {
      const time = toUnix(row[0] as DuckDBTimestampValue)
      const network = row[1] as string

      if (!series[network]) {
        series[network] = []
      }

      series[network].push({
        time,
        txCount: Number(row[2]),
        inflowUsd: Number(row[3]),
        outflowUsd: Number(row[4]),
        totalVolumeUsd: Number(row[5]),
        sharePct: Number(row[7]),
      })
    }

    return Object.entries(series).map(([network, series]) => ({
      network,
      series,
    }))
  }

  async networkAssetsSeries(criteria: TimeAndNetworkSelect, metric: 'tx' | 'usdVolume' | 'assetVolume') {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)
    const network = criteria.network
    let query = ''

    if (metric === 'usdVolume') {
      query = `
        WITH base AS (
          SELECT
            time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
            t.asset,
            t.symbol,
            t.volume,
            t.origin,
            t.destination
          FROM xcm_transfers t
          WHERE
            t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
            AND ('${network}' = t.origin OR '${network}' = t.destination)
        )
        SELECT
          time_range,
          asset,
          ARBITRARY(symbol) AS symbol,
          CASE WHEN COUNT(volume) = 0 THEN NULL ELSE SUM(volume) END AS total_volume_usd,
          CASE
            WHEN COUNT(volume) = 0 THEN NULL
            ELSE COALESCE(SUM(volume) FILTER (WHERE destination = '${network}'), 0)
          END AS inflow_usd,
          CASE
            WHEN COUNT(volume) = 0 THEN NULL
            ELSE COALESCE(SUM(volume) FILTER (WHERE origin = '${network}'), 0)
          END AS outflow_usd
        FROM base
        GROUP BY time_range, asset
        ORDER BY total_volume_usd DESC;
      `
    } else if (metric === 'assetVolume') {
      query = `
        WITH base AS (
          SELECT
            time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
            t.asset,
            ARBITRARY(t.symbol) AS symbol,
            ARBITRARY(t.decimals) AS decimals,
            SUM(t.amount) AS total_amount,
            SUM(t.amount) FILTER (WHERE t.destination = '${network}') AS inflow_amount,
            SUM(t.amount) FILTER (WHERE t.origin = '${network}') AS outflow_amount
          FROM xcm_transfers t
          WHERE
            t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
            AND ('${network}' = t.origin OR '${network}' = t.destination)
          GROUP BY t.asset, time_range
        )
        SELECT
          b.time_range,
          b.asset,
          b.symbol,
          CASE
            WHEN b.symbol != '' THEN COALESCE(b.total_amount / POWER(10, b.decimals), 0)
            ELSE NULL
          END AS total_volume,
          CASE
            WHEN b.symbol != '' THEN COALESCE(b.inflow_amount / POWER(10, b.decimals), 0)
            ELSE NULL
          END AS inflow,
          CASE
            WHEN b.symbol != '' THEN COALESCE(b.outflow_amount / POWER(10, b.decimals), 0)
            ELSE NULL
          END AS outflow
        FROM base b
        ORDER BY total_volume DESC;
      `
    } else {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
          t.asset,
          ANY_VALUE(t.symbol) AS symbol,
          COUNT(*) AS tx_count,
          COUNT(*) FILTER (WHERE t.destination = '${network}') AS in_tx_count,
          COUNT(*) FILTER (WHERE t.origin = '${network}') AS out_tx_count,
        FROM xcm_transfers t
        WHERE
          t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          AND ('${network}' = t.origin OR '${network}' = t.destination)

        GROUP BY t.asset, time_range
        ORDER BY tx_count DESC;
      `
    }

    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()

    const data: Record<string, NetworkAssetData> = {}

    for (const row of rows) {
      const time = toUnix(row[0] as DuckDBTimestampValue)
      const key = fromDuckDBBlob(row[1] as DuckDBBlobValue)
      const total = toNullableNumber(row[3])
      const inflow = toNullableNumber(row[4])
      const outflow = toNullableNumber(row[5])
      const netflow = inflow !== null && outflow !== null ? inflow - outflow : null

      const item = (data[key] ??= {
        key,
        symbol: row[2] as string,
        total: null,
        inflow: null,
        outflow: null,
        netflow: null,
        series: [],
      })

      accumulate('total', total, item)
      accumulate('inflow', inflow, item)
      accumulate('outflow', outflow, item)
      accumulate('netflow', netflow, item)

      item.series.push({ time, value: total ?? 0 })
    }

    const dataArray = Object.values(data)
    dataArray.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))

    return dataArray
  }

  async networkChannelSeries(criteria: TimeAndNetworkSelect, metric: 'tx' | 'usdVolume') {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)
    const network = criteria.network
    let query = ''
    if (metric === 'usdVolume') {
      query = `
        WITH base AS (
          SELECT
            time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
            CASE
              WHEN t.origin = '${network}' THEN t.destination
              ELSE t.origin
            END AS counterparty_network,
            t.volume,
            t.origin,
            t.destination
          FROM xcm_transfers t
          WHERE
            t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
            AND ('${network}' = t.origin OR '${network}' = t.destination)
        )
        SELECT
          time_range,
          counterparty_network,
          CASE WHEN COUNT(volume) = 0 THEN NULL ELSE SUM(volume) END AS total_volume_usd,
          CASE
            WHEN COUNT(volume) = 0 THEN NULL
            ELSE COALESCE(SUM(volume) FILTER (WHERE destination = '${network}'), 0)
          END AS inflow_usd,
          CASE
            WHEN COUNT(volume) = 0 THEN NULL
            ELSE COALESCE(SUM(volume) FILTER (WHERE origin = '${network}'), 0)
          END AS outflow_usd
        FROM base
        GROUP BY time_range, counterparty_network
        ORDER BY time_range;
      `
    } else if (metric === 'tx') {
      query = `
        SELECT
          time_bucket(INTERVAL '${safe(bucketInterval)}', t.sent_at) AS time_range,
          CASE
            WHEN t.origin = '${network}' THEN t.destination
            ELSE t.origin
          END AS counterparty_network,
          COUNT(*) AS tx_count,
          COUNT(*) FILTER (WHERE t.destination = '${network}') AS in_tx_count,
          COUNT(*) FILTER (WHERE t.origin = '${network}') AS out_tx_count
        FROM xcm_transfers t
        WHERE
          t.sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
          AND ('${network}' = t.origin OR '${network}' = t.destination)
          AND t.destination IS NOT NULL
          AND t.origin IS NOT NULL
        GROUP BY counterparty_network, time_range
        ORDER BY time_range;
      `
    }
    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()

    const data: Record<string, NetworkFlowData> = {}

    for (const row of rows) {
      const time = toUnix(row[0] as DuckDBTimestampValue)
      const key = row[1] as string
      const total = toNullableNumber(row[2])
      const inflow = toNullableNumber(row[3])
      const outflow = toNullableNumber(row[4])
      const netflow = inflow !== null && outflow !== null ? inflow - outflow : null

      const item = (data[key] ??= {
        key,
        total: null,
        inflow: null,
        outflow: null,
        netflow: null,
        series: [],
      })

      accumulate('total', total, item)
      accumulate('inflow', inflow, item)
      accumulate('outflow', outflow, item)
      accumulate('netflow', netflow, item)

      item.series.push({ time, value: total ?? 0 })
    }

    const dataArray = Object.values(data)
    dataArray.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))

    return dataArray
  }

  async protocolAnalytics(criteria: TimeSelect) {
    const bucketInterval = criteria.bucket ?? '1 hours'
    const timeframe = criteria.timeframe
    const unit = getUnit(bucketInterval)

    const query = `
      WITH base AS (
        SELECT
          origin_protocol AS protocol,
          correlation_id,
          from_address,
          to_address,
          volume,
          EXTRACT(EPOCH FROM (recv_at - sent_at)) AS time_spent
        FROM xcm_transfers
        WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')

        UNION ALL

        SELECT
          destination_protocol AS protocol,
          correlation_id,
          from_address,
          to_address,
          volume,
          EXTRACT(EPOCH FROM (recv_at - sent_at)) AS time_spent
        FROM xcm_transfers
        WHERE sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${safe(timeframe)}')
      ),

      deduped AS (
        SELECT
          protocol,
          correlation_id,
          MAX(COALESCE(volume, 0)) AS volume,
          AVG(time_spent) AS avg_time_spent,
          ANY_VALUE(from_address) AS from_address,
          ANY_VALUE(to_address) AS to_address
        FROM base
        GROUP BY protocol, correlation_id
      )

      SELECT
        d.protocol,
        COUNT(*) AS tx_count,
        (
          SELECT COUNT(DISTINCT addr)
          FROM (
            SELECT from_address AS addr FROM deduped WHERE protocol = d.protocol
            UNION
            SELECT to_address AS addr FROM deduped WHERE protocol = d.protocol
          ) AS all_addresses
        ) AS unique_accounts,
        SUM(volume) AS volume_usd,
        AVG(avg_time_spent) AS avg_time_spent
      FROM deduped d
      GROUP BY d.protocol
      ORDER BY volume_usd DESC;
    `

    const result = await this.#db.run(query.trim())
    const rows = await result.getRows()

    const avgXcmTime = await this.averageTimeXcm(criteria)

    return rows.map((row) => {
      const protocol = row[0] as string
      return {
        protocol,
        count: Number(row[1]),
        accounts: Number(row[2]),
        volumeUsd: Number(row[3]),
        avgTimeSpent: protocol === 'xcm' && avgXcmTime !== null ? avgXcmTime : Number(row[4]),
      }
    })
  }

  /**
   * Returns the average time in seconds for transfers that start and end on XCM.
   */
  async averageTimeXcm(criteria: TimeSelect): Promise<number | null> {
    const timeframe = safe(criteria.timeframe)
    const unit = getUnit(criteria.bucket ?? '1 hours')

    const query = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (recv_at - sent_at))) AS avg_time
      FROM xcm_transfers
      WHERE origin_protocol = 'xcm'
        AND destination_protocol = 'xcm'
        AND sent_at >= DATE_TRUNC('${unit}', NOW() - INTERVAL '${timeframe}');
    `.trim()

    const result = await this.#db.run(query)
    const rows = await result.getRows()
    const avgTimeSpent = rows[0]?.[0] !== null ? Number(rows[0][0]) : null

    return avgTimeSpent
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

  async networkAssetsByUsd(criteria: TimeAndNetworkSelect) {
    return this.networkAssetsSeries(criteria, 'usdVolume')
  }

  async networkAssetsByAsset(criteria: TimeAndNetworkSelect) {
    return this.networkAssetsSeries(criteria, 'assetVolume')
  }

  async networkAssetsByTx(criteria: TimeAndNetworkSelect) {
    return this.networkAssetsSeries(criteria, 'tx')
  }

  async networkChannelsByUsd(criteria: TimeAndNetworkSelect) {
    return this.networkChannelSeries(criteria, 'usdVolume')
  }

  async networkChannelsByTx(criteria: TimeAndNetworkSelect) {
    return this.networkChannelSeries(criteria, 'tx')
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

function accumulate<T extends NetworkFlowData>(
  prop: 'total' | 'inflow' | 'outflow' | 'netflow',
  value: number | null,
  item: T,
) {
  if (value === null) {
    return
  }
  item[prop] = item[prop] === null ? value : item[prop]! + value
}

function toUnix(value: DuckDBTimestampValue): number {
  return Math.floor(new Date(value.toString()).getTime() / 1000)
}

function toNullableNumber(value: DuckDBValue): number | null {
  return value !== null ? Number(value) : null
}

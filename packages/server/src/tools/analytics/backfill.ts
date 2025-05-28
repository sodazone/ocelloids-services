import fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import { DuckDBInstance, dateFromTimestampValue } from '@duckdb/node-api'

const CG_ID_MAP: Record<string, string> = {
  DOT: 'polkadot',
  ETH: 'ethereum',
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
  TBTC: 'tbtc',
  LINK: 'chainlink',
  SKY: 'sky',
  LDO: 'lido-dao',
  AAVE: 'aave',
  LBTC: 'lombard-staked-btc',
  GLMR: 'moonbeam',
  ASTR: 'astar',
  ACA: 'aca',
  BNC: 'bifrost-native-coin',
  HDX: 'hydradx',
  MYTH: 'mythos',
  CFG: 'centrifuge',
  PHA: 'pha',
  USDT: 'tether',
  USDC: 'usd-coin',
  VDOT: 'voucher-dot',
  VASTR: 'bifrost-voucher-astr',
  VGLMR: 'voucher-glmr',
  KSM: 'kusama',
}

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))

const filePath = process.env.ANALYTICS_DB_PATH
if (filePath === undefined) {
  throw new Error('Database file path not specified. Please configure env variable ANALYTICS_DB_PATH')
}

console.log('Creating DuckDB instance from', filePath)
const instance = await DuckDBInstance.create(filePath, {
  max_memory: '1GB',
  wal_autocheckpoint: '5MB',
  TimeZone: 'UTC',
})
const connection = await instance.connect()

async function backfillVolume() {
  const cacheFilePath = path.resolve(__dirname, `__data__/prices`, 'coingecko_price_cache.json')

  // Step 1: Load existing cache from file if it exists
  let priceCache: Record<string, { time: number; price: number }[]> = {}
  try {
    const cacheFileContent = fs.readFileSync(cacheFilePath, 'utf-8')
    priceCache = JSON.parse(cacheFileContent)
    console.log('Loaded existing price cache from file.')
  } catch (_error) {
    console.warn('No existing cache file found. Starting with an empty cache.')
  }

  // Step 2: Add the volume column if it doesn't exist
  await connection.run(`
    ALTER TABLE xcm_transfers ADD COLUMN IF NOT EXISTS volume DECIMAL(18,4);
  `)

  // Step 3: Fetch all transfers without volume
  const transfers = await connection
    .run(`
    SELECT id, symbol, amount, decimals, sent_at
    FROM xcm_transfers
    WHERE volume IS NULL;
  `)
    .then((result) => result.getRows())

  // Step 4: Fetch historical price data and update volume
  for (const [i, transfer] of transfers.entries()) {
    const id = Number(transfer[0] as number)
    const symbol = (transfer[1] as string).toUpperCase()
    const amount = Number(transfer[2] as bigint)
    const decimals = Number(transfer[3] as number)
    const sentAt = dateFromTimestampValue(transfer[4])
    const coingeckoId = CG_ID_MAP[symbol]
    if (i === 0 || i % 200 === 0) {
      console.log('TRANSFER ----', i, symbol, amount, decimals, sentAt, coingeckoId)
    }

    if (!coingeckoId) {
      console.warn(`No CoinGecko ID found for symbol: ${symbol}, skipping...`)
      continue
    }

    // Fetch historical price data if not cached
    if (!priceCache[coingeckoId]) {
      console.log(`Fetching historical prices for ${symbol} (${coingeckoId})`)
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=60&interval=daily`,
      )
      if (!response.ok) {
        console.warn(
          `Error fetching data from CoinGecko for asset ${coingeckoId}. Message: ${await response.text()}`,
        )
        continue
      }
      const data = await response.json()
      priceCache[coingeckoId] = data.prices.map(([time, price]: [number, number]) => ({
        time, // millis
        price,
      }))

      // Save the updated cache to the file
      fs.writeFileSync(cacheFilePath, JSON.stringify(priceCache, null, 2), 'utf-8')
      console.log(`Updated cache saved to ${cacheFilePath}`)
    }

    // Find the closest price in time to the transfer's sent_at
    const transferTime = sentAt.getTime()
    const closestPrice = priceCache[coingeckoId]
      .filter((entry) => entry.time <= transferTime) // Only consider prices before the transfer time
      .at(-1)

    if (!closestPrice) {
      console.warn(`No historical price found for transfer ID: ${id}`)
      continue
    }

    // Calculate volume in USD
    const volume = (amount / Math.pow(10, decimals)) * closestPrice.price // Adjust for decimals if needed

    // Update the volume column in the database
    await connection.run(`
      UPDATE xcm_transfers
      SET volume = ${volume}
      WHERE id = ${id};
    `)
  }

  console.log('Backfill complete.')
}

// Run the backfill process
backfillVolume()
  .catch((error) => {
    console.error('Error during backfill:', error)
  })
  .finally(() => {
    console.log('shutting down...')
    connection.closeSync()
    process.exit()
  })

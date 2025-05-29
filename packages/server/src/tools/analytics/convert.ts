import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'

import { toDuckDBHex } from '@/common/util.js'

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

async function updateAssetsColumn(db: DuckDBConnection) {
  // Fetch all transfers where asset matches 'urn:ocn:polkadot:2034|'
  const transfers = await db
    .run(`
    SELECT id, asset
    FROM xcm_transfers
    WHERE asset = ${toDuckDBHex('urn:ocn:polkadot:2034|')}
  `)
    .then((result) => result.getRows())

  for (const [i, transfer] of transfers.entries()) {
    if (i % 200 === 0) {
      console.log('Updating', i)
    }
    const id = transfer[0] as number

    // Convert the asset to 'urn:ocn:polkadot:2034|0'
    const updatedAsset = toDuckDBHex('urn:ocn:polkadot:2034|0')

    // Update the asset column in the database
    await db.run(`
      UPDATE xcm_transfers
      SET asset = ${updatedAsset}
      WHERE id = ${id};
    `)
  }

  console.log('Asset id converted successfully.')
}

updateAssetsColumn(connection)
  .catch((error) => {
    console.error('Error converting asset column:', error)
  })
  .finally(() => {
    connection.closeSync()
    process.exit(0)
  })

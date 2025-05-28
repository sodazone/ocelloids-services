import { DuckDBBlobValue, DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'

import { fromDuckDBBlob, toDuckDBHex } from '@/common/util.js'

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
  // Fetch all transfers from the xcm_transfers table
  const transfers = await db.run('SELECT id, asset FROM xcm_transfers').then((result) => result.getRows())

  for (const [i, transfer] of transfers.entries()) {
    if (i % 200 === 0) {
      console.log('Updating', i)
    }
    const id = transfer[0] as number
    const assetBlob = transfer[1] as DuckDBBlobValue

    // Decode the asset value, convert to lowercase, and encode back to blob
    const decodedAsset = fromDuckDBBlob(assetBlob)
    const updatedAsset = toDuckDBHex(decodedAsset.toLowerCase())

    // Update the asset column in the database
    await db.run(`
      UPDATE xcm_transfers
      SET asset = ${updatedAsset}
      WHERE id = ${id};
    `)
  }

  console.log('Asset column updated successfully.')
}


updateAssetsColumn(connection)
  .catch((error) => {
    console.error('Error updating asset column:', error)
  })
  .finally(() => {
    connection.closeSync()
    process.exit(0)
  })


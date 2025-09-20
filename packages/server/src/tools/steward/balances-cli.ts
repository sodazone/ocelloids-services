import fs from 'fs'
import path from 'path'
import { Command } from 'commander'
import { Level } from 'level'

import { createBalancesCodec } from '@/services/agents/steward/balances/codec.js'

const program = new Command()

program
  .requiredOption('-d, --db <path>', 'Path to LevelDB folder')
  .option('-l, --limit <n>', 'Items per page', '10')
  .option('-a, --address <hex>', 'Filter by address (0x...)')
  .option('-s, --stats', 'Show only DB statistics (no listing)')
  .parse(process.argv)

const options = program.opts()
const dbPath: string = options.db
const limit: number = parseInt(options.limit, 10)
const filterAddress: string | undefined = options.address
;(async () => {
  const db = new Level<Buffer, Buffer>(dbPath, {
    valueEncoding: 'buffer',
    keyEncoding: 'buffer',
  })
  const codec = createBalancesCodec()

  if (options.stats) {
    const size = await getDirSize(dbPath)
    const assetsPerAddress: Map<string, number> = new Map()
    let entryCount = 0

    for await (const [key] of db.iterator()) {
      try {
        const { addressHex } = codec.key.dec(key as Buffer)
        const addr = addressHex.toLowerCase()
        assetsPerAddress.set(addr, (assetsPerAddress.get(addr) ?? 0) + 1)
        entryCount++
      } catch {
        // skip undecodable key
      }
    }

    const uniqueAddresses = assetsPerAddress.size
    const counts = Array.from(assetsPerAddress.values()).sort((a, b) => a - b)
    const avg = counts.reduce((acc, c) => acc + c, 0) / (counts.length || 1)
    const median =
      counts.length === 0
        ? 0
        : counts.length % 2 === 1
          ? counts[(counts.length - 1) / 2]
          : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2

    console.log(`DB folder: ${dbPath}`)
    console.log(`Approx. size on disk: ${(size / (1024 * 1024)).toFixed(2)} MB`)
    console.log(`Total entries: ${entryCount}`)
    console.log(`Unique addresses: ${uniqueAddresses}`)
    console.log(`Average assets per address: ${avg.toFixed(2)}`)
    console.log(`Median assets per address: ${median}`)
    console.log(`Min assets per address: ${counts[0] ?? 0}`)
    console.log(`Max assets per address: ${counts[counts.length - 1] ?? 0}`)

    await db.close()
    return
  }

  console.log(`Reading from ${dbPath} (${limit} per page)\n`)

  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const buffer: Array<[Buffer, Buffer]> = []
  for await (const [key, value] of db.iterator()) {
    if (filterAddress) {
      try {
        const { addressHex } = codec.key.dec(key as Buffer)
        if (addressHex.toLowerCase() !== filterAddress.toLowerCase()) {
          continue
        }
      } catch {
        continue
      }
    }
    buffer.push([key as Buffer, value as Buffer])
  }

  let index = 0
  let page = 1
  while (index < buffer.length) {
    console.log(`\nPage ${page}\n`)
    const slice = buffer.slice(index, index + limit)
    slice.forEach(([key, value], i) => {
      try {
        const decodedKey = codec.key.dec(key)
        const decodedValue = codec.value.dec(value)
        console.log(
          `${index + i + 1}. address=${decodedKey.addressHex} asset=${decodedKey.assetIdHex} balance=${decodedValue.balance.toString()} epoch=${decodedValue.epochSeconds}`,
        )
      } catch (err) {
        console.error(`Error decoding entry at index ${index + i}:`, err)
      }
    })

    index += slice.length
    page++
    if (index >= buffer.length) {
      break
    }

    await new Promise<void>((resolve) => rl.question('\nPress Enter to show next page...', () => resolve()))
  }

  rl.close()
  await db.close()
  console.log('\nDone.')
})()

async function getDirSize(dir: string): Promise<number> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return getDirSize(full)
      }
      const { size } = await fs.promises.stat(full)
      return size
    }),
  )
  return sizes.reduce((a, b) => a + b, 0)
}

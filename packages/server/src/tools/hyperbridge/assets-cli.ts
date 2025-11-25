#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'fs'
import { Level } from 'level'
import path from 'path'
import { AssetMetadata } from '@/services/agents/hyperbridge/registry/mappers.js'

const program = new Command()

program
  .requiredOption('-d, --db <path>', 'Path to AssetMetadata LevelDB folder')
  .option('-l, --limit <n>', 'Items per page', '20')
  .option('-f, --filter <prefix>', 'Filter by asset key prefix (e.g. chain ID)')
  .option('-s, --stats', 'Show DB statistics only')
  .parse(process.argv)

const options = program.opts()
const dbPath: string = options.db
const limit: number = parseInt(options.limit, 10)
const filterPrefix: string | undefined = options.filter

;(async () => {
  const db = new Level<string, any>(dbPath)
  const assetsDb = db.sublevel<string, AssetMetadata>('agent:hyperbridge:assets', { valueEncoding: 'json' })

  // -----------------------
  // STATS MODE
  // -----------------------
  if (options.stats) {
    const size = await getDirSize(dbPath)

    let total = 0
    for await (const _ of assetsDb.iterator()) {
      total++
    }

    console.log(`DB folder: ${dbPath}`)
    console.log(`Approx size on disk: ${(size / (1024 * 1024)).toFixed(2)} MB`)
    console.log(`Total assets stored: ${total}`)

    await db.close()
    return
  }

  console.log(`Reading from ${dbPath} (${limit} per page)`)

  // -----------------------
  // LOAD KEYS
  // -----------------------
  const items: Array<[string, { symbol?: string; decimals?: number }]> = []

  for await (const [key, value] of assetsDb.iterator()) {
    if (filterPrefix && !key.startsWith(filterPrefix)) {
      continue
    }
    items.push([key, value])
  }

  if (items.length === 0) {
    console.log('No matching entries found.')
    await db.close()
    return
  }

  // -----------------------
  // PAGINATION
  // -----------------------
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let index = 0
  let page = 1

  while (index < items.length) {
    console.log(`\nPage ${page}\n`)
    const slice = items.slice(index, index + limit)

    slice.forEach(([key, value], i) => {
      const { symbol, decimals } = value
      console.log(`${index + i + 1}. key=${key} symbol=${symbol ?? '-'} decimals=${decimals ?? '-'}`)
    })

    index += slice.length
    page++

    if (index >= items.length) {
      break
    }

    await new Promise<void>((resolve) => rl.question('\nPress Enter to show next page...', () => resolve()))
  }

  rl.close()
  await db.close()
  console.log('\nDone.')
})()

// -----------------------
// UTIL: Gets folder size
// -----------------------
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

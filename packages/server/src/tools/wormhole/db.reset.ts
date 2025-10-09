import path from 'path'
import { Level } from 'level'

import { makeWormholeLevelStorage } from '@/services/networking/apis/wormhole/storage.js'
import { LevelDB } from '@/services/types.js'

async function main() {
  const dbPathArg = process.argv[2]
  if (!dbPathArg) {
    console.error('Usage: node db.reset.js <path-to-database>')
    process.exit(1)
  }

  // Resolve relative to the current working directory
  const absoluteDbPath = path.resolve(process.cwd(), dbPathArg)

  const db = new Level(absoluteDbPath) as LevelDB
  const storage = makeWormholeLevelStorage(db)

  await storage.reset()
  await db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import path from 'path'

import { CrosschainRepository } from '@/services/agents/crosschain/index.js'
import { createCrosschainDatabase } from '@/services/agents/crosschain/repositories/db.js'

async function main() {
  const dbPathArg = process.argv[2]
  if (!dbPathArg) {
    console.error('Usage: node db.utils.js <path-to-database>')
    process.exit(1)
  }

  // Resolve relative to the current working directory
  const absoluteDbPath = path.resolve(process.cwd(), dbPathArg)

  const { db } = createCrosschainDatabase(absoluteDbPath)
  const repository = new CrosschainRepository(db)

  const protocols = ['wh', 'wh_portal', 'wh_relayer']

  for (const protocol of protocols) {
    const deleted = await repository.deleteJourneysByProtocol(protocol)
    console.log(`Deleted ${deleted[0].numDeletedRows} journeys of type ${protocol}`)
  }

  await repository.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

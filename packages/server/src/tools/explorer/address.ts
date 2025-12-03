import { sql } from 'kysely'
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
  console.log('Creating DB at', absoluteDbPath)

  const { db } = createCrosschainDatabase(absoluteDbPath)
  const repository = new CrosschainRepository(db)

  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000

  const journeys = await db
    .selectFrom('xc_journeys')
    .select(['id', 'to'])
    .where('origin', '=', 'urn:ocn:ethereum:1')
    .where('destination', '=', 'urn:ocn:polkadot:2034')
    .where('to', 'like', '0x45544800%')
    .where('sent_at', '>=', sixtyDaysAgo)
    .execute()

  console.log(`Found ${journeys.length} journeys to update`)

  // Step 2: Transform and update each journey
  for (const journey of journeys) {
    const lower = journey.to.toLowerCase()
    let newTo: string = journey.to

    if (lower.startsWith('0x45544800')) {
      newTo = `0x${lower.substring(10, 50)}`
    }

    try {
      await repository.updateJourney(journey.id, { to: newTo, to_formatted: sql`NULL` as any })
    } catch (e) {
      console.error(e, `Error updating journey ${journey.id}`)
    }
  }

  console.log('Update complete.')
  await repository.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

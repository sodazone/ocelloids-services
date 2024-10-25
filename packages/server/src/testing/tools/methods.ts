import { pino } from 'pino'

import { ArchiveClient } from '@/services/networking/index.js'
import { networks } from './networks.js'

async function main([name, ws]: [string, string]) {
  const client = new ArchiveClient(pino(), name, ws)

  console.log(await client.getRpcMethods())

  client.disconnect()
}

main(Object.entries(networks)[0])

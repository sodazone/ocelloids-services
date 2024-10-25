import fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import { pino } from 'pino'
import toml from 'toml'

import { $ServiceConfiguration } from '@/services/config.js'
import { ArchiveClient } from '@/services/networking/index.js'

const __dirname = url.fileURLToPath(new URL('../../..', import.meta.url))

async function checkRpcMethods(url: string) {
  const _ = (v: boolean) => (v ? '✅' : '❌')

  const client = new ArchiveClient(pino(), 'chain', url)

  const { methods } = await client.getRpcMethods()
  const supports = (apiPrefix: string, count: number) => {
    const c = methods.filter((m) => m.startsWith(apiPrefix)).length
    return `${_(c > 1)} [${c},${count}]\t${apiPrefix}`
  }
  console.log(
    `${url}
${supports('archive_unstable', 7)}
${supports('chainHead_v1', 9)}
${supports('chainSpec_v1', 3)}
${supports('chain_', 19)}
`,
  )

  client.disconnect()
}

const configPath = path.resolve(__dirname, 'config/suspects.toml')
const config = $ServiceConfiguration.parse(toml.parse(fs.readFileSync(configPath, 'utf-8')))

await Promise.all(
  Array<Promise<void>>().concat(
    config.networks.flatMap((network) =>
      Array<string>()
        .concat(network.provider.url)
        .map((ws) => checkRpcMethods(ws)),
    ),
  ),
)

process.exit(0)

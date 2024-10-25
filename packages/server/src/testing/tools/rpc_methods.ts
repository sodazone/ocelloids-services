import fs from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

import { pino } from 'pino'
import toml from 'toml'

import { $ServiceConfiguration } from '@/services/config.js'
import { ArchiveClient } from '@/services/networking/index.js'
import { Command } from 'commander'

async function checkRpcMethods(configFile: string) {
  const configPath = resolve(cwd(), configFile)
  const config = $ServiceConfiguration.parse(toml.parse(fs.readFileSync(configPath, 'utf-8')))

  async function check(url: string) {
    const _ = (v: boolean) => (v ? '✅' : '❌')

    const client = new ArchiveClient(pino(), 'chain', url)

    const { methods } = await client.getRpcMethods()
    const supports = (apiPrefix: string, count: number) => {
      const c = methods.filter((m) => m.startsWith(apiPrefix)).length
      return `${_(c > 0)} [${c},${count}] ${apiPrefix}`
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

  await Promise.all(
    Array<Promise<void>>().concat(
      config.networks.flatMap((network) => Array<string>().concat(network.provider.url).map(check)),
    ),
  )
  process.exit(0)
}

new Command()
  .name('rpc-methods')
  .description('Check available RPC methods')
  .argument('<configFile>', 'configuration file')
  .action(checkRpcMethods)
  .version('0.0.1')
  .parse()

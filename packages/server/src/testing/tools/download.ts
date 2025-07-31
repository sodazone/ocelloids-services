import fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import { Command, Option } from 'commander'
import { pino } from 'pino'

import { createSubstrateClient } from '@/services/networking/substrate/client.js'
import { encodeBlock } from '@/services/networking/substrate/codec.js'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))

export const networks = {
  polkadot: 'wss://rpc.ibp.network/polkadot',
  assethub: 'wss://polkadot-asset-hub-rpc.polkadot.io',
  bridgehub: 'wss://sys.ibp.network/bridgehub-polkadot',
  hydra: 'wss://hydradx.paras.ibp.network',
  moonbeam: 'wss://moonbeam.ibp.network',
  astar: 'wss://rpc.astar.network',
  bifrost: 'wss://bifrost-polkadot.ibp.network',
  interlay: 'wss://api.interlay.io/parachain',
  acala: 'wss://acala-rpc.dwellir.com',
  mythos: 'wss://mythos.ibp.network',
  kassethub: 'wss://sys.ibp.network/asset-hub-kusama',
} as Record<string, string>

async function download([name, ws, height]: [string, string, number]) {
  const logger = pino()
  const client = await createSubstrateClient(logger, name, ws)

  logger.info('Downloading %s@%s', name, height)

  const hash = await client.getBlockHash(height)

  logger.info('Block hash %s', hash)

  const block = await client.getBlock(hash)

  const dest = path.resolve(__dirname, `__data__/blocks/${client.chainId}`, `${block.number}.cbor`)

  logger.info('Write %s', dest)

  fs.writeFileSync(dest, encodeBlock(block))

  client.disconnect()
}

new Command()
  .name('download')
  .description('Download blocks by height')
  .argument('<height>', 'block height')
  .addOption(
    new Option('-n, --network <name>', 'network name').default('polkadot').choices(Object.keys(networks)),
  )
  .action(async (height, { network }) => {
    if (!/^[0-9]+$/.test(height)) {
      throw new Error('Height should be positive int')
    }

    const ws = networks[network]
    if (ws) {
      await download([network, ws, Number(height)])
    } else {
      throw new Error(`Network name not found: ${network}`)
    }
  })
  .version('0.0.1')
  .parse()

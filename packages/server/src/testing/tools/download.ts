import fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import { Command, Option } from 'commander'
import { pino } from 'pino'

import { EvmApi } from '@/services/networking/evm/client.js'
import { encodeEvmBlock } from '@/services/networking/evm/codec.js'
import { createSubstrateClient } from '@/services/networking/substrate/client.js'
import { encodeBlock } from '@/services/networking/substrate/codec.js'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))

// -------------------------
// Separate network lists
// -------------------------

export const substrateNetworks: Record<string, string> = {
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
  nexus: 'wss://nexus.ibp.network',
  kassethub: 'wss://sys.ibp.network/asset-hub-kusama',
  kbridgehub: 'wss://sys.ibp.network/bridgehub-kusama',
  passethub: 'wss://sys.ibp.network/asset-hub-paseo',
}

export const evmNetworks: Record<string, { url: string; networkId: string }> = {
  ethereum: { url: 'https://eth.llamarpc.com', networkId: 'urn:ocn:ethereum:1' },
}

// -------------------------
// Helper
// -------------------------
function getNetworkInfo(name: string) {
  if (substrateNetworks[name]) {
    return { type: 'substrate', endpoint: substrateNetworks[name], networkId: name }
  }
  if (evmNetworks[name]) {
    const config = evmNetworks[name]
    return { type: 'evm', endpoint: config.url, networkId: config.networkId }
  }
  throw new Error(`Unknown network: ${name}`)
}

// -------------------------
// Download logic
// -------------------------
async function download([name, endpoint, height, type]: [string, string, number, string]) {
  const logger = pino()
  logger.info('Downloading %s@%s (%s)', name, height, type)

  if (type === 'evm') {
    const client = new EvmApi(logger, name, endpoint)
    await client.connect()

    const hash = await client.getBlockHash(height)
    logger.info('Block hash %s', hash)

    const block = await client.getBlockWithLogs(hash)
    const chain = Object.entries(evmNetworks).find(([_name, { networkId }]) => networkId === client.chainId)
    const dest = path.resolve(
      __dirname,
      `__data__/blocks/${chain ? chain[0] : client.chainId}`,
      `${block.number}.cbor`,
    )

    logger.info('Write %s', dest)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, encodeEvmBlock(block))

    await client.disconnect()
  } else {
    const client = await createSubstrateClient(logger, name, endpoint)

    const hash = await client.getBlockHash(height)
    logger.info('Block hash %s', hash)

    const block = await client.getBlock(hash, false)
    const dest = path.resolve(__dirname, `__data__/blocks/${client.chainId}`, `${block.number}.cbor`)

    logger.info('Write %s', dest)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, encodeBlock(block))

    client.disconnect()
  }
}

// -------------------------
// CLI entrypoint
// -------------------------
new Command()
  .name('download')
  .description('Download blocks by height (Substrate or EVM)')
  .argument('<height>', 'block height')
  .addOption(
    new Option('-n, --network <name>', 'network name')
      .default('polkadot')
      .choices([...Object.keys(substrateNetworks), ...Object.keys(evmNetworks)]),
  )
  .action(async (height, { network }) => {
    if (!/^[0-9]+$/.test(height)) {
      throw new Error('Height should be a positive integer')
    }

    const { endpoint, type, networkId } = getNetworkInfo(network)
    await download([networkId, endpoint, Number(height), type])
  })
  .version('0.0.3')
  .parse()

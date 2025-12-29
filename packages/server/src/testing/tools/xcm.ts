import { Command, Option } from 'commander'
import { pino } from 'pino'
import { asJSON } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { createSubstrateClient } from '@/services/networking/substrate/client.js'
import { StorageCodec } from '@/services/networking/substrate/types.js'
import { substrateNetworks } from './common.js'

async function download([name, endpoint, height, protocol]: [string, string, number, string]) {
  const logger = pino()
  logger.info('Downloading XCM data for %s@%s', name, height)
  const client = await createSubstrateClient(logger, name, endpoint)
  const context = await client.ctx()

  const hash = await client.getBlockHash(height)
  logger.info('Block hash %s', hash)

  let codec: StorageCodec<any>

  if (protocol === 'hrmp') {
    codec = context.storageCodec('ParachainSystem', 'HrmpOutboundMessages')
  } else if (protocol === 'ump') {
    codec = context.storageCodec('ParachainSystem', 'UpwardMessages')
  } else {
    codec = context.storageCodec('Dmp', 'DownwardMessageQueues')
  }

  const key = codec.keys.enc() as HexString
  const buffer = await client.getStorage(key, hash)

  logger.info('Data: %s', asJSON(codec.value.dec(buffer)))

  await client.disconnect()
}

new Command()
  .name('xcm')
  .description('Download xcm data by height')
  .argument('<height>', 'block height')
  .addOption(
    new Option('-n, --network <name>', 'network name')
      .default('polkadot')
      .choices([...Object.keys(substrateNetworks)]),
  )
  .addOption(
    new Option('-p, --protocol <type>', 'protocol type').default('hrmp').choices(['hrmp', 'ump', 'dmp']),
  )
  .action(async (height, { network, protocol }) => {
    if (!/^[0-9]+$/.test(height)) {
      throw new Error('Height should be a positive integer')
    }
    const endpoint = substrateNetworks[network]
    await download([network, endpoint, Number(height), protocol])
  })
  .version('0.0.1')
  .parse()

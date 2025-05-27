import * as fs from 'node:fs'
import path from 'node:path'
import * as url from 'node:url'

import { getObservableClient } from '@polkadot-api/observable-client'
import { createClient } from '@polkadot-api/substrate-client'
import { getWsProvider } from 'polkadot-api/ws-provider/node'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))
const dest = path.resolve(__dirname, '__data__/metadata/', 'new.scale')

const substrateClient = createClient(getWsProvider('wss://rpc.ibp.network/polkadot'))
const client = getObservableClient(substrateClient)
client.chainHead$().runtime$.subscribe((ctx) => {
  if (ctx?.metadataRaw) {
    console.log('>', dest)
    fs.writeFileSync(dest, ctx.metadataRaw)
    process.exit(0)
  }
})

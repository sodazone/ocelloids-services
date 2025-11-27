import * as fs from 'node:fs'
import path from 'node:path'
import * as url from 'node:url'
import { withLegacy } from '@polkadot-api/legacy-provider'
import { getObservableClient } from '@polkadot-api/observable-client'
import { createClient } from '@polkadot-api/substrate-client'
import { getWsProvider, WebSocketClass } from 'polkadot-api/ws-provider'
import { WS } from '@/services/networking/substrate/websocket.js'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))
const dest = path.resolve(__dirname, '__data__/metadata/', 'nexus.scale')

const substrateClient = createClient(
  getWsProvider('wss://nexus.ibp.network', {
    websocketClass: WS as unknown as WebSocketClass,
    innerEnhancer: withLegacy(),
    timeout: 5_000,
  }),
)
const client = getObservableClient(substrateClient)
client.chainHead$().runtime$.subscribe((ctx) => {
  if (ctx?.metadataRaw) {
    console.log('>', dest)
    fs.writeFileSync(dest, ctx.metadataRaw)
    process.exit(0)
  }
})

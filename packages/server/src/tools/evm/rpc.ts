import { pino } from 'pino'

import { EvmApi } from '@/services/networking/evm/client.js'
import { Logger } from '@/services/types.js'

const log = pino() as Logger
const api = new EvmApi(log, 'urn:ocn:ethereum:1284', 'https://rpc.api.moonbeam.network')

await api.connect()

api.followHeads$('finalized', 0).subscribe((b) => {
  console.log('FIN', b.height)
})

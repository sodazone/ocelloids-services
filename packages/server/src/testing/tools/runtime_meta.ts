import { pino } from 'pino'
import { fromHex } from 'polkadot-api/utils'
import { SubstrateClient } from '@/services/networking/substrate/client.js'
import { createContextFromOpaqueMetadata } from '@/services/networking/substrate/context.js'

const client = new SubstrateClient(pino(), 'chain', 'wss://api.interlay.io/parachain')

//const m = await client.rpc.runtimeCall('Metadata_metadata_at_version', toHex(u32.enc(15)))
const m = await client.rpc.getMetadata()
console.log('start', m.substring(0, 50))
const ctx = createContextFromOpaqueMetadata(fromHex(m), 'lol')
console.log(ctx)

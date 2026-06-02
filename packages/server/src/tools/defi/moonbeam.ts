import { pino } from 'pino'
import { moonbeamDexMonitor } from '@/services/agents/defi/networks/moonbeam/monitor.js'
import { EvmLocalConsumer } from '@/services/networking/evm/ingress/local.js'
import { initRuntime } from './ctx.js'

process.env.OC_SUBSTRATE_BACKFILL_FILE = './b.json'

const { services } = initRuntime()

const consumer = new EvmLocalConsumer(services)
const monitor = moonbeamDexMonitor(pino(), consumer)
await consumer.start()

monitor.start()

monitor.events$.subscribe((event) => {
  console.log('E>', event)
})

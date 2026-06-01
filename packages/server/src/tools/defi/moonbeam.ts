import { moonbeamDexMonitor } from '@/services/agents/defi/networks/moonbeam/monitor.js'
import { EvmLocalConsumer } from '@/services/networking/evm/ingress/local.js'
import { initRuntime } from './ctx.js'

const { services } = initRuntime()
const consumer = new EvmLocalConsumer(services)
const monitor = moonbeamDexMonitor(consumer)

monitor.start()

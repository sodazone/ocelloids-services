import { pino } from 'pino'
import { moonbeamDexMonitor } from '@/services/agents/defi/networks/moonbeam/monitor.js'
import { EvmLocalConsumer } from '@/services/networking/evm/ingress/local.js'
import { initRuntime } from './ctx.js'

const { services } = initRuntime()
const consumer = new EvmLocalConsumer(services)
const log = pino()
const monitor = moonbeamDexMonitor(log, consumer)

monitor.start()

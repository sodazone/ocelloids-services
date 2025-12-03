import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { AgentRuntimeContext } from '@/services/agents/types.js'
import { ServiceConfiguration } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateLocalConsumer } from '@/services/networking/substrate/ingress/index.js'
import { SubsStore } from '@/services/persistence/level/subs.js'
import { Logger, OpenLevelDB, Services } from '@/services/types.js'
import { InjectableConnector } from './inject.js'
import { makeTelegramBot } from './tg.js'

export function initRuntime() {
  const log = pino() as Logger
  const bot = makeTelegramBot()

  const egress = {
    publish: async (sub: any, message: any) => {
      console.log(`${sub.id}=>`)
      console.log(message.metadata, message.payload)
      bot.send(message)
    },
  } as unknown as Egress
  const db = new MemoryLevel()
  const openLevelDB: OpenLevelDB = (_name: string, options?: any) => new MemoryLevel(options)
  const config = new ServiceConfiguration({
    substrate: {
      networks: [
        {
          id: 'urn:ocn:polkadot:0',
          provider: {
            type: 'rpc',
            url: 'wss://rpc.polkadot.io',
          },
        },
      ],
    },
    evm: { networks: [] },
    bitcoin: { networks: [] },
  })
  const connector = new InjectableConnector(log, config)

  const _services = {
    log,
    egress,
    levelDB: db,
    subsStore: new SubsStore(log, new MemoryLevel()),
    openLevelDB,
    localConfig: config,
    connector,
  } as Partial<Services>
  const ingress = {
    substrate: new SubstrateLocalConsumer(_services as Services),
    bitcoin: null,
    evm: null,
  } as unknown as IngressConsumers
  _services.ingress = ingress

  const services = _services as Services
  const ctx = {
    log,
    egress,
    db,
    openLevelDB,
    ingress,
  } as AgentRuntimeContext

  return {
    services,
    ctx,
    connector,
  }
}

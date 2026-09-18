import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { AgentRuntimeContext } from '@/services/agents/types.js'
import { ServiceConfiguration } from '@/services/config.js'
import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import Connector from '@/services/networking/connector.js'
import { SubstrateLocalConsumer } from '@/services/networking/substrate/ingress/index.js'
import { SubsStore } from '@/services/persistence/level/subs.js'
import { Logger, OpenLevelDB, Services } from '@/services/types.js'

export function initRuntime() {
  const log = pino() as Logger

  const egress = {
    publish: async (sub: any, message: any) => {
      console.log(`${sub.id}=>`)
      console.log(message.metadata, message.payload)
    },
  } as unknown as Egress
  const db = new MemoryLevel()
  const openLevelDB: OpenLevelDB = (_name: string, options?: any) => new MemoryLevel(options)
  const config = new ServiceConfiguration({
    substrate: {
      networks: [],
    },
    evm: {
      networks: [
        {
          id: 'urn:ocn:ethereum:1284',
          provider: {
            type: 'rpc',
            url: [
              'https://rpc.api.moonbeam.network',
              'https://moonbeam-rpc.publicnode.com',
              'https://moonbeam.api.pocket.network',
              'https://moonbeam.unitedbloc.com',
            ],
          },
        },
        {
          id: 'urn:ocn:ethereum:222222',
          provider: {
            type: 'rpc',
            url: ['https://rpc.hydradx.cloud', 'https://hydration-rpc.n.dwellir.com'],
          },
        },
        {
          id: 'urn:ocn:ethereum:4663',
          maxBlockDist: 1_200,
          provider: {
            type: 'rpc',
            url: [
              'https://robinhood.api.pocket.network',
              'https://lb.routeme.sh/rpc/evm/4663',
              'https://rpc.nodeflare.app/robinhood/public',
              'https://rpc-robinhood.blockmachine.io',
              'https://robinhood.rpc.blxrbdn.com',
              'https://rpc.ordofi.network',
              'https://robinhood-rpc.publicnode.com',
              'https://rpc.mainnet.chain.robinhood.com',
            ],
          },
        },
      ],
    },
    bitcoin: { networks: [] },
  })
  const connector = new Connector(log, config)

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

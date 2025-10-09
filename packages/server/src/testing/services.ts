import { DatabaseOptions } from 'level'
import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { of } from 'rxjs'
import toml from 'toml'
import { createArchiveDatabase } from '@/services/archive/db.js'
import { ArchiveRepository } from '@/services/archive/repository.js'
import { IngressConsumers } from '@/services/ingress/consumer/types.js'
import { BitcoinIngressConsumer } from '@/services/networking/bitcoin/ingress/types.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { SubstrateLocalConsumer } from '@/services/networking/substrate/ingress/index.js'
import { SubstrateApi } from '@/services/networking/substrate/types.js'
import { LocalAgentCatalog } from '../services/agents/catalog/local.js'
import { AgentCatalog } from '../services/agents/types.js'
import { $ServiceConfiguration, ServiceConfiguration } from '../services/config.js'
import { Egress } from '../services/egress/index.js'
import Connector from '../services/networking/connector.js'
import { SubsStore } from '../services/persistence/level/subs.js'
import { Janitor } from '../services/scheduling/janitor.js'
import { Scheduler } from '../services/scheduling/scheduler.js'
import { LevelDB, Services } from '../services/types.js'
import { AgentServiceMode } from '../types.js'
import { _configToml } from './data.js'

export const _log = pino({
  enabled: false,
})

export const _config = new ServiceConfiguration($ServiceConfiguration.parse(toml.parse(_configToml)))

function mockApiClient() {
  const _client = {
    followHeads$: of({}),
    connect: () => Promise.resolve(_client),
  }
  return {
    ..._client,
    isReady: () => Promise.resolve(_client),
    connect: () => Promise.resolve(_client),
  } as unknown as SubstrateApi
}

export const _mockApis = {
  'urn:ocn:local:0': mockApiClient(),
  'urn:ocn:local:1000': mockApiClient(),
  'urn:ocn:local:2000': mockApiClient(),
  'urn:ocn:local:3000': mockApiClient(),
  'urn:ocn:wococo:0': mockApiClient(),
  'urn:ocn:wococo:1000': mockApiClient(),
  'urn:ocn:wococo:1002': mockApiClient(),
  'urn:ocn:paseo:0': mockApiClient(),
}

export const _connector = {
  connectAll: () => _mockApis,
  disconnectAll: () => Promise.resolve(),
} as unknown as Connector

export function createServices(): Services {
  const { db: _archiveDB } = createArchiveDatabase(':memory:')
  const _rootDB = new MemoryLevel<string, any>() as LevelDB
  _rootDB.setMaxListeners(100)

  const __services: Services = {
    log: _log,
    localConfig: _config,
    connector: _connector,
    levelDB: _rootDB,
    openLevelDB: <K, V>(_name: string, options?: DatabaseOptions<K, V>) =>
      new MemoryLevel<K, V>(options) as LevelDB<K, V>,
    archive: new ArchiveRepository(_archiveDB),
    subsStore: {} as unknown as SubsStore,
    ingress: {} as unknown as IngressConsumers,
    agentCatalog: {} as unknown as AgentCatalog,
    egress: {} as unknown as Egress,
    scheduler: {
      on: () => {
        /* empty */
      },
    } as unknown as Scheduler,
    janitor: {
      on: () => {
        /* empty */
      },
      schedule: () => {
        /* empty */
      },
    } as unknown as Janitor,
  }

  const _ingress = {
    substrate: new SubstrateLocalConsumer(__services),
    bitcoin: {
      isNetworkDefined: () => false,
      collectTelemetry: () => {
        //
      },
    } as unknown as BitcoinIngressConsumer,
    // TODO: impl mock
    evm: {
      isNetworkDefined: () => false,
      collectTelemetry: () => {
        //
      },
    } as unknown as EvmIngressConsumer,
  }
  const _egress = new Egress(__services)
  const _subsDB = new SubsStore(_log, _rootDB)
  const _agentService = new LocalAgentCatalog(
    {
      ...__services,
      ingress: _ingress,
      egress: _egress,
      subsStore: _subsDB,
    } as Services,
    { agentServiceMode: AgentServiceMode.local, agents: '*', data: '', agentConfigs: {} },
  )

  return {
    ...__services,
    ingress: _ingress,
    egress: _egress,
    subsStore: _subsDB,
    agentCatalog: _agentService,
  } as Services
}

import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { of } from 'rxjs'
import toml from 'toml'

import { IngressConsumers } from '@/services/ingress/consumer/types.js'
import { BitcoinIngressConsumer } from '@/services/networking/bitcoin/ingress/types.js'
import { SubstrateLocalConsumer } from '@/services/networking/substrate/ingress/index.js'
import { SubstrateApi } from '@/services/networking/substrate/types.js'
import { LocalAgentCatalog } from '../services/agents/catalog/local.js'
import { AgentCatalog } from '../services/agents/types.js'
import { $ServiceConfiguration, ServiceConfiguration } from '../services/config.js'
import { Egress } from '../services/egress/index.js'
import Connector from '../services/networking/connector.js'
import { Janitor } from '../services/persistence/level/janitor.js'
import { Scheduler } from '../services/persistence/level/scheduler.js'
import { SubsStore } from '../services/persistence/level/subs.js'
import { Services } from '../services/types.js'
import { AgentServiceMode } from '../types.js'
import { _configToml } from './data.js'

export const _log = pino({
  enabled: false,
})

export const _config = new ServiceConfiguration($ServiceConfiguration.parse(toml.parse(_configToml)))

function mockApiClient() {
  const _client = {
    followHeads$: of({}),
  }
  return {
    ..._client,
    isReady: () => of(_client),
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
  connect: () => _mockApis,
} as unknown as Connector

export function createServices(): Services {
  const _rootDB = new MemoryLevel()
  _rootDB.setMaxListeners(100)

  const __services = {
    log: _log,
    localConfig: _config,
    connector: _connector,
    levelDB: _rootDB,
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
    { mode: AgentServiceMode.local },
  )

  return {
    ...__services,
    ingress: _ingress,
    egress: _egress,
    subsStore: _subsDB,
    agentCatalog: _agentService,
  } as Services
}

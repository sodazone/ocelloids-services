import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { of } from 'rxjs'
import toml from 'toml'

import { ApiClient } from '@/services/networking/index.js'

import { LocalAgentCatalog } from '../services/agents/catalog/local.js'
import { AgentCatalog } from '../services/agents/types.js'
import { $ServiceConfiguration } from '../services/config.js'
import { Egress } from '../services/egress/index.js'
import { IngressConsumer, LocalIngressConsumer } from '../services/ingress/consumer/index.js'
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

export const _config = $ServiceConfiguration.parse(toml.parse(_configToml))

function mockApiClient() {
  const _client = {
    finalizedHeads$: of({}),
  }
  return {
    ..._client,
    isReady: () => of(_client),
  } as unknown as ApiClient
}

export const _mockApis = {
  'urn:ocn:local:0': mockApiClient(),
  'urn:ocn:local:1000': mockApiClient(),
  'urn:ocn:local:2000': mockApiClient(),
  'urn:ocn:local:3000': mockApiClient(),
  'urn:ocn:wococo:1000': mockApiClient(),
  'urn:ocn:wococo:1002': mockApiClient(),
  'urn:ocn:paseo:0': mockApiClient(),
}

export const _connector = {
  connect: () => _mockApis,
} as unknown as Connector

export const _rootDB = new MemoryLevel()

const __services = {
  log: _log,
  localConfig: _config,
  connector: _connector,
  levelDB: _rootDB,
  subsStore: {} as unknown as SubsStore,
  ingress: {} as unknown as IngressConsumer,
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

export const _ingress = new LocalIngressConsumer(__services)
export const _egress = new Egress(__services)
export const _subsDB = new SubsStore(_log, _rootDB)
export const _agentService = new LocalAgentCatalog(
  {
    ...__services,
    ingress: _ingress,
    egress: _egress,
    subsStore: _subsDB,
  } as Services,
  { mode: AgentServiceMode.local },
)

export const _services = {
  ...__services,
  ingress: _ingress,
  subsStore: _subsDB,
  agentCatalog: _agentService,
} as Services

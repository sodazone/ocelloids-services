import { ApiPromise, ApiRx } from '@polkadot/api'
import { MemoryLevel } from 'memory-level'
import { pino } from 'pino'
import { of } from 'rxjs'
import toml from 'toml'

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

export const _mockApiPromises = {
  'urn:ocn:local:0': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
    } as unknown as ApiPromise),
  },
  'urn:ocn:local:1000': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
      at: () => {
        return Promise.resolve({
          query: {},
        })
      },
    } as unknown as ApiPromise),
  },
  'urn:ocn:local:2000': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
    } as unknown as ApiPromise),
  },
  'urn:ocn:local:3000': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
    } as unknown as ApiPromise),
  },
  'urn:ocn:wococo:1000': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
    } as unknown as ApiPromise),
  },
  'urn:ocn:wococo:1002': {
    isReady: Promise.resolve({
      registry: {
        createType: () => ({
          type: 'V3',
          asV3: [],
        }),
        hasType: () => true,
      },
      derive: {
        chain: {
          getBlock: () => {
            /* empty */
          },
        },
      },
      rpc: {
        state: {
          getMetadata: () => ({
            toU8a: () => new Uint8Array(0),
          }),
        },
      },
    } as unknown as ApiPromise),
  },
}

export const _mockApiRxs = {
  'urn:ocn:local:0': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  'urn:ocn:local:1000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  }),
  'urn:ocn:local:2000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  'urn:ocn:local:3000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  'urn:ocn:wococo:1000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  'urn:ocn:wococo:1002': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
}

export const _connector = {
  connect: () => ({
    promise: _mockApiPromises,
    rx: _mockApiRxs,
    chains: Object.keys(_mockApiRxs),
  }),
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
export const _subsDB = new SubsStore(_log, _rootDB)
export const _agentService = new LocalAgentCatalog(
  {
    ...__services,
    ingress: _ingress,
    subsStore: _subsDB,
  } as Services,
  { mode: AgentServiceMode.local },
)

export const _services = {
  ...__services,
  ingress: _ingress,
  egress: {} as unknown as Egress,
  subsStore: _subsDB,
  agentCatalog: _agentService,
} as Services

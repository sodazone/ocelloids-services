import { pino } from 'pino';
import toml from 'toml';
import { of } from 'rxjs';
import { MemoryLevel } from 'memory-level';
import { ApiRx, ApiPromise } from '@polkadot/api';

import { SubsStore } from '../services/persistence/subs.js';
import { Janitor } from '../services/persistence/janitor.js';
import { $ServiceConfiguration } from '../services/config.js';
import Connector from '../services/networking/connector.js';
import { _configToml } from './data.js';
import { Scheduler } from '../services/persistence/scheduler.js';
import { IngressConsumer, LocalIngressConsumer } from '../services/ingress/consumer/index.js';
import { Services } from '../services/types.js';

export const _log = pino({
  enabled: false,
});

export const _config = $ServiceConfiguration.parse(toml.parse(_configToml));

export const _mockApiPromises = {
  '0': {
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
          getBlock: () => {},
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
  '1000': {
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
          getBlock: () => {},
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
        });
      },
    } as unknown as ApiPromise),
  },
  '2000': {
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
          getBlock: () => {},
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
  '3000': {
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
          getBlock: () => {},
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
};

export const _mockApiRxs = {
  '0': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  '1000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  }),
  '2000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
  '3000': of({
    rpc: {
      chain: {
        subscribeFinalizedHeads: () => of({}),
      },
    },
  } as unknown as ApiRx),
};

export const _connector = {
  connect: () => ({
    promise: _mockApiPromises,
    rx: _mockApiRxs,
    chains: Object.keys(_mockApiRxs),
  }),
} as unknown as Connector;

export const _rootDB = new MemoryLevel();

const __services = {
  log: _log,
  localConfig: _config,
  connector: _connector,
  rootStore: _rootDB,
  subsStore: {} as unknown as SubsStore,
  ingress: {} as unknown as IngressConsumer,
  scheduler: {
    on: () => {},
  } as unknown as Scheduler,
  janitor: {
    on: () => {},
    schedule: () => {},
  } as unknown as Janitor,
};

export const _ingress = new LocalIngressConsumer(__services);
export const _subsDB = new SubsStore(_log, _rootDB, _ingress);

export const _services = {
  ...__services,
  ingress: _ingress,
  subsStore: _subsDB,
} as Services;

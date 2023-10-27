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

export const _log = pino({
  enabled: false
});

export const _config = $ServiceConfiguration.parse(
  toml.parse(_configToml)
);

export const _connector = {
  connect: () => ({
    promise: {
      '0': {
        derive: {
          chain: {
            getBlock: () => {

            }
          }
        }
      } as unknown as ApiPromise,
      '1000': {
        derive: {
          chain: {
            getBlock: () => {
            }
          }
        },
        at: () => {
          return Promise.resolve({
            query: { }
          });
        }
      } as unknown as ApiPromise,
      '2000': {
        derive: {
          chain: {
            getBlock: () => {
            }
          }
        }
      } as unknown as ApiPromise,
      '3000': {
        derive: {
          chain: {
            getBlock: () => {
            }
          }
        }
      } as unknown as ApiPromise
    },
    rx: {
      '0': of({
        rpc: {
          chain: {
            subscribeFinalizedHeads: () => of({})
          },
        }
      } as unknown as ApiRx),
      '1000': of({
        rpc: {
          chain: {
            subscribeFinalizedHeads: () => of({})
          },
        }
      }),
      '2000': of({
        rpc: {
          chain: {
            subscribeFinalizedHeads: () => of({})
          },
        }
      } as unknown as ApiRx),
      '3000': of({
        rpc: {
          chain: {
            subscribeFinalizedHeads: () => of({})
          },
        }
      } as unknown as ApiRx)
    }
  })
} as unknown as Connector;

export const _rootDB = new MemoryLevel();
export const _subsDB = new SubsStore(
  _log, _rootDB, _config
);

export const _services = {
  log: _log,
  config: _config,
  connector: _connector,
  storage: {
    root: _rootDB,
    subs: _subsDB
  },
  scheduler: {
    on: () => {}
  } as unknown as Scheduler,
  janitor: {
    schedule: () => {}
  } as unknown as Janitor
};

import { pino } from 'pino';
import toml from 'toml';
import { MemoryLevel } from 'memory-level';

import { SubsStore } from '../services/persistence/subs.js';
import { Janitor } from '../services/persistence/janitor.js';
import { $ServiceConfiguration } from '../services/configuration.js';
import Connector from '../services/networking/connector.js';
import { _configToml } from './data.js';
import { Scheduler } from '../services/persistence/scheduler.js';

export const _log = pino({
  enabled: false
});

export const _config = $ServiceConfiguration.parse(
  toml.parse(_configToml)
);

export const _services = {
  log: _log,
  config: _config,
  connector: {} as unknown as Connector,
  storage: {
    root: new MemoryLevel(),
    subs: {} as unknown as SubsStore
  },
  scheduler: {} as unknown as Scheduler,
  janitor: {
    schedule: () => {}
  } as unknown as Janitor
};

import { pino } from 'pino';
import toml from 'toml';

import { SubsDB } from '../services/storage/subs.js';
import { Janitor } from '../services/storage/janitor.js';
import { $ServiceConfiguration } from '../services/configuration.js';
import Connector from '../services/networking/connector.js';
import { DB } from '../services/types';
import { _configToml } from './data.js';

export const _Pino = pino({
  enabled: false
});

export const _Config = $ServiceConfiguration.parse(
  toml.parse(_configToml)
);

export const _Services = {
  log: _Pino,
  config: _Config,
  connector: {} as unknown as Connector,
  storage: {
    db: {} as unknown as DB,
    subsDB: {} as unknown as SubsDB
  },
  janitor: {
    schedule: () => {}
  } as unknown as Janitor
};
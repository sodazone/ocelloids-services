import { pino } from 'pino';
import toml from 'toml';

import { SubsDB } from '../services/storage/subs.js';
import { Janitor } from '../services/storage/janitor.js';
import { $ServiceConfiguration } from '../services/configuration.js';
import Connector from '../services/networking/connector.js';
import { DB } from '../services/types';

export const _configToml = `
[[networks]]
id = 0
name = "local_relay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9000"

[[networks]]
id = 1_000
name = "local_1"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9001"

[[networks]]
id = 2_000
name = "local_2000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9002"

[[networks]]
id = 3_000
name = "local_3000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9003"
`;

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
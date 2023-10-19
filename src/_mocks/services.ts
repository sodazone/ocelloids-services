import { pino } from 'pino';

import { SubsDB } from '../services/storage/subs.js';
import { Janitor } from '../services/storage/janitor.js';
import { ServiceConfiguration } from '../services/configuration.js';
import Connector from '../services/connector/connector.js';
import { DB } from '../services/types';

export const MockServices = {
  log: pino({
    enabled: false
  }),
  config: {} as unknown as ServiceConfiguration,
  connector: {} as unknown as Connector,
  storage: {
    db: {} as unknown as DB,
    subsDB: {} as unknown as SubsDB
  },
  janitor: {
    schedule: () => {}
  } as unknown as Janitor
};
import pino from 'pino';
import { AbstractLevel } from 'abstract-level';

import { SubsDB } from './storage/subs.js';
import { Janitor } from './storage/janitor.js';
import { ServiceConfiguration } from './configuration.js';
import Connector from './networking/connector.js';

export type DB = AbstractLevel<Buffer | Uint8Array | string, string, any>;
export type Logger = pino.BaseLogger;
export type Services = {
  log: Logger,
  storage: {
    db: DB,
    subsDB: SubsDB
  },
  janitor: Janitor,
  config: ServiceConfiguration,
  connector: Connector
}

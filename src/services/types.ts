import pino from 'pino';
import {
  AbstractLevel,
  AbstractSublevel,
  AbstractBatchOperation
} from 'abstract-level';

import { SubsDB } from './storage/subs.js';
import { Janitor } from './storage/janitor.js';
import { ServiceConfiguration } from './configuration.js';
import Connector from './networking/connector.js';

export type DB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>;
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<DB, F, K, V>;
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<DB, K, V>;

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

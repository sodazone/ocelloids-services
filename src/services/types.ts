import {
  AbstractLevel,
  AbstractSublevel,
  AbstractBatchOperation
} from 'abstract-level';

import { SubsStore } from './persistence/subs.js';
import { Janitor } from './persistence/janitor.js';
import { ServiceConfiguration } from './configuration.js';
import Connector from './networking/connector.js';
import { FastifyBaseLogger } from 'fastify';

export type DB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>;
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<DB, F, K, V>;
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<DB, K, V>;

export type Logger = FastifyBaseLogger
export type Services = {
  log: Logger,
  storage: {
    root: DB,
    subs: SubsStore
  },
  janitor: Janitor,
  config: ServiceConfiguration,
  connector: Connector
}

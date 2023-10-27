import {
  AbstractLevel,
  AbstractSublevel,
  AbstractBatchOperation
} from 'abstract-level';

import { SubsStore } from './persistence/subs.js';
import { Janitor } from './persistence/janitor.js';
import { ServiceConfiguration } from './config.js';
import Connector from './networking/connector.js';
import { FastifyBaseLogger } from 'fastify';
import { Scheduler } from './persistence/scheduler.js';

export type DB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>;
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<DB, F, K, V>;
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<DB, K, V>;

/**
 * Sublevel prefixes.
 */
export const prefixes = {
  subs: {
    family: (chainId: string | number) => `su:${chainId}`,
    uniques: 'su:ukeys'
  },
  sched: {
    tasks: 'sc:tasks'
  },
  cache: {
    family: (chainId: string | number) => `ch:${chainId}`,
    tips: 'ch:fi'
  },
  matching: {
    outbound: 'ma:out',
    inbound: 'ma:in'
  }
};
export const jsonEncoded = { valueEncoding: 'json' };

export type Logger = FastifyBaseLogger
export type Services = {
  log: Logger,
  storage: {
    root: DB,
    subs: SubsStore
  },
  janitor: Janitor,
  scheduler: Scheduler,
  config: ServiceConfiguration,
  connector: Connector
}

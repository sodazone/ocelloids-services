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
import { HexString } from './monitoring/types.js';

export type DB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>;
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<DB, F, K, V>;
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<DB, K, V>;

/**
 * Sublevel prefixes.
 */
export const prefixes = {
  subs: {
    family: (chainId: string) => `su:${chainId}`
  },
  sched: {
    tasks: 'sc:tasks'
  },
  cache: {
    family: (chainId: string) => `ch:${chainId}`,
    keys: {
      block: (hash: HexString) => `blk:${hash}`,
      ump: (hash: HexString) => `ump:${hash}`,
      hrmp: (hash: HexString) => `hrm:${hash}`
    },
    tips: 'ch:fi'
  },
  matching: {
    outbound: 'ma:out',
    inbound: 'ma:in'
  }
};
export const jsonEncoded = { valueEncoding: 'json' };

type EventMap = {
  [key: string | symbol]: (...args: any[]) => void
}

/**
 * https://github.com/andywer/typed-emitter
 * The MIT License (MIT)
 * Copyright (c) 2018 Andy Wermke
 */
export interface TypedEventEmitter<Events extends EventMap> {
  addListener<E extends keyof Events> (event: E, listener: Events[E]): this
  on<E extends keyof Events> (event: E, listener: Events[E]): this
  once<E extends keyof Events> (event: E, listener: Events[E]): this
  prependListener<E extends keyof Events> (event: E, listener: Events[E]): this
  prependOnceListener<E extends keyof Events> (event: E, listener: Events[E]): this

  off<E extends keyof Events>(event: E, listener: Events[E]): this
  removeAllListeners<E extends keyof Events> (event?: E): this
  removeListener<E extends keyof Events> (event: E, listener: Events[E]): this

  emit<E extends keyof Events> (event: E, ...args: Parameters<Events[E]>): boolean
  eventNames (): (keyof Events | string | symbol)[]
  rawListeners<E extends keyof Events> (event: E): Events[E][]
  listeners<E extends keyof Events> (event: E): Events[E][]
  listenerCount<E extends keyof Events> (event: E): number

  getMaxListeners (): number
  setMaxListeners (maxListeners: number): this
}

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

import { AbstractBatchOperation, AbstractLevel, AbstractSublevel } from 'abstract-level'

import { FastifyBaseLogger } from 'fastify'

import { AgentCatalog, AgentId } from './agents/types.js'
import { ServiceConfiguration } from './config.js'
import { Egress } from './egress/index.js'
import { IngressConsumer } from './ingress/consumer/index.js'
import Connector from './networking/connector.js'
import { Janitor } from './persistence/level/janitor.js'
import { Scheduler } from './persistence/level/scheduler.js'
import { SubsStore } from './persistence/level/subs.js'
import { BlockNumberRange, HexString } from './subscriptions/types.js'

/**
 * The network URN.
 *
 * @public
 */
export type NetworkURN = `urn:ocn:${string}`

export type LevelDB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<LevelDB, F, K, V>
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<LevelDB, K, V>
export type SubLevel<V> = Family<Buffer | Uint8Array | string, string, V>

/**
 * Supported Abstract Level engines.
 */
export enum LevelEngine {
  classic = 'classic',
  rave = 'rave',
  mem = 'mem',
}

/**
 * Sublevel prefixes.
 */
export const prefixes = {
  subs: {
    family: (agentId: AgentId) => `su:${agentId}`,
  },
  sched: {
    tasks: 'sc:tasks',
  },
  cache: {
    family: (chainId: NetworkURN) => `ch:${chainId}`,
    keys: {
      block: (hash: HexString) => `blk:${hash}`,
      storage: (storageKey: HexString, blockHash = '$') => `st:${storageKey}:${blockHash}`,
      range: (range: BlockNumberRange) => `${range.fromBlockNum}-${range.toBlockNum}`,
    },
    ranges: (chainId: NetworkURN) => `ch:rg:${chainId}`,
    tips: 'ch:fi',
  },
  distributor: {
    lastBlockStreamId: (chainId: NetworkURN) => `dis:blocks:lid:${chainId}`,
  },
}
export const jsonEncoded = { valueEncoding: 'json' }

type EventMap = {
  [key: string | symbol]: (...args: any[]) => void
}

/**
 * https://github.com/andywer/typed-emitter
 * The MIT License (MIT)
 * Copyright (c) 2018 Andy Wermke
 */
export interface TypedEventEmitter<Events extends EventMap> {
  addListener<E extends keyof Events>(event: E, listener: Events[E]): this
  on<E extends keyof Events>(event: E, listener: Events[E]): this
  once<E extends keyof Events>(event: E, listener: Events[E]): this
  prependListener<E extends keyof Events>(event: E, listener: Events[E]): this
  prependOnceListener<E extends keyof Events>(event: E, listener: Events[E]): this

  off<E extends keyof Events>(event: E, listener: Events[E]): this
  removeAllListeners<E extends keyof Events>(event?: E): this
  removeListener<E extends keyof Events>(event: E, listener: Events[E]): this

  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean
  eventNames(): (keyof Events | string | symbol)[]
  rawListeners<E extends keyof Events>(event: E): Events[E][]
  listeners<E extends keyof Events>(event: E): Events[E][]
  listenerCount<E extends keyof Events>(event: E): number

  getMaxListeners(): number
  setMaxListeners(maxListeners: number): this
}

export type Logger = FastifyBaseLogger
export type Services = {
  log: Logger
  levelDB: LevelDB
  subsStore: SubsStore
  janitor: Janitor
  scheduler: Scheduler
  localConfig: ServiceConfiguration
  ingress: IngressConsumer
  egress: Egress
  agentCatalog: AgentCatalog
  connector: Connector
}

/**
 * Represents a generic JSON object.
 *
 * @public
 */
export type AnyJson =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnyJson[]
  | {
      [index: string]: AnyJson
    }

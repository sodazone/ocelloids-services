import { AbstractBatchOperation, AbstractLevel, AbstractSublevel } from 'abstract-level'

import { FastifyBaseLogger } from 'fastify'
import { AgentService } from './agents/types.js'
import { ServiceConfiguration } from './config.js'
import { IngressConsumer } from './ingress/consumer/index.js'
import Connector from './networking/connector.js'
import { Janitor } from './persistence/janitor.js'
import { Scheduler } from './persistence/scheduler.js'
import { SubsStore } from './persistence/subs.js'
import { AgentId, BlockNumberRange, HexString } from './subscriptions/types.js'

export type NetworkURN = `urn:ocn:${string}`

export type DB<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractLevel<F, K, V>
export type Family<F = Buffer | Uint8Array | string, K = string, V = any> = AbstractSublevel<DB, F, K, V>
export type BatchOperation<K = string, V = any> = AbstractBatchOperation<DB, K, V>

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
  matching: {
    outbound: 'ma:out',
    inbound: 'ma:in',
    relay: 'ma:relay',
    hop: 'ma:hop',
    bridge: 'ma:bridge',
    bridgeAccepted: 'ma:bridgeAccepted',
    bridgeDelivered: 'ma:bridgeDelivered',
    bridgeIn: 'ma:bridgeIn',
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
  rootStore: DB
  subsStore: SubsStore
  janitor: Janitor
  scheduler: Scheduler
  localConfig: ServiceConfiguration
  ingressConsumer: IngressConsumer
  agentService: AgentService
  connector: Connector
}

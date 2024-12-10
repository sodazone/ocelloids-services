import { EventEmitter } from 'node:events'

import { Observable, Subject, from, map, shareReplay } from 'rxjs'

import { LevelDB, Logger, NetworkURN, Services, prefixes } from '@/services/types.js'

import {
  NetworkEntry,
  NetworkRecord,
  NetworksKey,
  RedisDistributor,
  getBlockStreamKey,
  getMetadataKey,
  getReplyToKey,
  getStorageKeysReqKey,
  getStorageReqKey,
} from '@/services/ingress/distributor.js'
import { IngressOptions } from '@/types.js'

import { HexString } from '@/services/subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { safeDestr } from 'destr'
import { decodeBlock } from '../../codec.js'
import { Block, SubstrateApiContext, createRuntimeApiContext } from '../../index.js'
import { SubstrateNetworkInfo, SubstrateIngressConsumer } from '../types.js'

/**
 * Represents an implementation of {@link SubstrateIngressConsumer} that operates in a distributed environment.
 *
 * This class is responsible for managing block consumption and storage retrieval logic,
 * communicating through a distributed middleware.
 */
export class SubstrateDistributedConsumer
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements SubstrateIngressConsumer
{
  readonly #log: Logger
  readonly #db: LevelDB
  readonly #blockConsumers: Record<NetworkURN, Subject<Block>>
  readonly #contexts$: Record<NetworkURN, Observable<SubstrateApiContext>>
  readonly #distributor: RedisDistributor

  #networks: NetworkRecord = {}

  constructor(ctx: Services, opts: IngressOptions) {
    super()

    this.#log = ctx.log
    this.#db = ctx.levelDB
    this.#distributor = new RedisDistributor(opts, ctx)
    this.#blockConsumers = {}
    this.#contexts$ = {}
  }

  async start() {
    await this.#distributor.start()
    await this.#networksFromRedis()

    for (const chainId of this.getChainIds()) {
      this.#blockConsumers[chainId] = new Subject<Block>()

      let lastId = '$'
      // TODO option to omit the stream pointer on start (?)
      try {
        lastId = await this.#db.get(prefixes.distributor.lastBlockStreamId(chainId))
      } catch {
        //
      }
      this.#log.info('[%s] Distributed block consumer (lastId=%s)', chainId, lastId)

      await this.#blockStreamFromRedis(chainId)
    }
  }

  async stop() {
    await this.#distributor.stop()
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const consumer = this.#blockConsumers[chainId]
    if (consumer === undefined) {
      this.emit('telemetryIngressConsumerError', 'missingBlockConsumer')

      throw new Error('Missing distributed consumer for chain=' + chainId)
    }
    return consumer.asObservable()
  }

  getContext(chainId: NetworkURN): Observable<SubstrateApiContext> {
    if (this.#contexts$[chainId] === undefined) {
      this.#contexts$[chainId] = from(this.#distributor.getBuffers(getMetadataKey(chainId))).pipe(
        map((metadata) => {
          if (metadata === null) {
            this.emit('telemetryIngressConsumerError', `missingMetadata(${chainId})`)

            throw new Error(`No metadata found for ${chainId}`)
          }
          return createRuntimeApiContext(metadata, chainId)
        }),
        // TODO retry
        shareReplay({
          refCount: true,
        }),
      )
    }
    return this.#contexts$[chainId]
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString> {
    try {
      return this.#storageFromRedis(chainId, storageKey, blockHash)
    } catch (error) {
      this.emit('telemetryIngressConsumerError', 'storageFromRedis')

      throw error
    }
  }

  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number = 100,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]> {
    try {
      return this.#storageKeysFromRedis(chainId, keyPrefix, count.toString(), startKey, blockHash)
    } catch (error) {
      this.emit('telemetryIngressConsumerError', 'storageKeysFromRedis')

      throw error
    }
  }

  getChainIds(): NetworkURN[] {
    return Object.keys(this.#networks) as NetworkURN[]
  }

  getRelayIds(): NetworkURN[] {
    return Object.entries(this.#networks)
      .filter(([_, value]) => value.isRelay)
      .map(([key, _]) => key) as NetworkURN[]
  }

  isRelay(chainId: NetworkURN) {
    return this.#networks[chainId]?.isRelay
  }

  isNetworkDefined(chainId: NetworkURN) {
    return this.#networks[chainId] !== undefined
  }

  getNetworkInfo(chainId: NetworkURN): Promise<SubstrateNetworkInfo> {
    if (this.#networks[chainId] === undefined) {
      Promise.reject(new Error('unknown network'))
    }
    return Promise.resolve(this.#networks[chainId].info as SubstrateNetworkInfo)
  }

  collectTelemetry(collect: TelemetryCollect): void {
    collect(this)
  }

  async #networksFromRedis() {
    try {
      const members = await this.#distributor.smembers(NetworksKey)
      if (members.length > 0) {
        for (const m of members) {
          const network = safeDestr<NetworkEntry>(m)
          if (this.#networks[network.id] === undefined) {
            this.#log.info('[%s] READ network configuration (relay?=%s)', network.id, network.isRelay)
            this.#networks[network.id] = network
          }
          // TODO handle removal
        }
      }
      setTimeout(() => {
        this.#networksFromRedis()
      }, 60_000)
    } catch (error) {
      this.emit('telemetryIngressConsumerError', 'readNetworks')

      this.#log.error(error, 'Error reading networks from Redis')
      throw error
    }
  }

  #storageKeysFromRedis(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: string,
    startKey?: HexString,
    blockHash?: HexString,
  ) {
    return from(
      new Promise<HexString[]>((resolve, reject) => {
        const distributor = this.#distributor
        const replyTo = getReplyToKey(chainId, keyPrefix, blockHash ?? '$')
        const streamKey = getStorageKeysReqKey(chainId)
        const req = {
          replyTo,
          keyPrefix,
          count,
          startKey: startKey ?? '0x0',
          at: blockHash ?? '0x0',
        }

        distributor
          .add(streamKey, '*', req, {
            TRIM: {
              strategy: 'MAXLEN',
              strategyModifier: '~',
              threshold: 50,
            },
          })
          .then(() => {
            distributor
              .response(replyTo)
              .then((buffer) => {
                if (buffer) {
                  resolve(safeDestr(buffer.element.toString()))
                } else {
                  reject(`Error retrieving storage keys for prefix ${keyPrefix} (reply-to=${replyTo})`)
                }
              })
              .catch(reject)
          })
          .catch(reject)
      }),
    )
  }

  #storageFromRedis(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString) {
    return from(
      new Promise<HexString>((resolve, reject) => {
        const distributor = this.#distributor
        const replyTo = getReplyToKey(chainId, storageKey, blockHash ?? '$')
        const streamKey = getStorageReqKey(chainId)
        const req = {
          replyTo,
          storageKey,
          at: blockHash ?? '0x0',
        }

        distributor
          .add(streamKey, '*', req, {
            TRIM: {
              strategy: 'MAXLEN',
              strategyModifier: '~',
              threshold: 50,
            },
          })
          .then(() => {
            distributor
              .response(replyTo)
              .then((buffer) => {
                if (buffer) {
                  resolve(`0x${buffer.element.toString('hex')}`)
                } else {
                  reject(`Error retrieving storage value for key ${storageKey} (reply-to=${replyTo})`)
                }
              })
              .catch(reject)
          })
          .catch(reject)
      }),
    )
  }

  async #blockStreamFromRedis(chainId: NetworkURN, id: string = '$') {
    const subject = this.#blockConsumers[chainId]
    const key = getBlockStreamKey(chainId)

    this.#distributor.readBuffers<{
      bytes: Buffer
    }>(
      key,
      (message, { lastId }) => {
        const buffer = message['bytes']
        const block = decodeBlock(buffer)
        subject.next(block)

        this.#log.info('[%s] INGRESS block #%s %s (%s)', chainId, block.number, block.hash, lastId)

        setImmediate(async () => {
          try {
            await this.#db.put(prefixes.distributor.lastBlockStreamId(chainId), lastId)
          } catch {
            this.emit('telemetryIngressConsumerError', `putLastId(${chainId})`, 'warning')
          }
        })
      },
      id,
    )
  }
}

import { EventEmitter } from 'node:events'
import { Observable, filter, firstValueFrom, map, mergeMap, of, retry } from 'rxjs'

import { withLegacy } from '@polkadot-api/legacy-provider'
import { ChainHead$, SystemEvent, getObservableClient } from '@polkadot-api/observable-client'
import { StopError, createClient } from '@polkadot-api/substrate-client'
import { WebSocketClass, WsJsonRpcProvider, getWsProvider } from 'polkadot-api/ws-provider'

import { asSerializable } from '@/common/index.js'

import { toHex } from 'polkadot-api/utils'
import { HexString } from '../../subscriptions/types.js'
import { Logger } from '../../types.js'
import { NeutralHeader } from '../types.js'
import { RuntimeApiContext } from './context.js'
import { RpcApi, createRpcApi } from './rpc.js'
import { RuntimeManager, createRuntimeManager, getRuntimeVersion } from './runtime.js'
import { Block, BlockInfoWithStatus, SubstrateApi, SubstrateApiContext } from './types.js'
import { WS } from './websocket.js'

export async function createSubstrateClient(log: Logger, chainId: string, url: string | Array<string>) {
  const client = new SubstrateClient(log, chainId, url)
  return await client.connect()
}

const retryOnStopError = <T>() =>
  retry<T>({
    delay(error: unknown) {
      if (error instanceof StopError) {
        return of(null)
      }
      throw error
    },
  })

/**
 * Archive Substrate API client.
 */
export class SubstrateClient extends EventEmitter implements SubstrateApi {
  #connected: boolean = false
  readonly chainId: string

  readonly #log: Logger
  readonly #wsProvider: WsJsonRpcProvider
  readonly #client: { chainHead$: () => ChainHead$; destroy: () => void }
  readonly #rpc: RpcApi
  readonly #head: ChainHead$

  #runtimeManager: RuntimeManager

  get rpc() {
    return this.#rpc
  }

  get #finalized$(): Observable<BlockInfoWithStatus> {
    return this.#head.finalized$.pipe(map((b) => ({ ...b, status: 'finalized' })))
  }

  get #new$(): Observable<BlockInfoWithStatus> {
    return this.#head.follow$.pipe(
      mergeMap((event) => {
        const blocks: BlockInfoWithStatus[] = []
        switch (event.type) {
          case 'newBlock': {
            const { parentBlockHash: parent, blockHash: hash } = event
            blocks.push({ hash, parent, number: -1, status: 'new' })
            break
          }
          case 'finalized': {
            const { prunedBlockHashes, finalizedBlockHashes } = event
            for (const hash of prunedBlockHashes) {
              blocks.push({ parent: '0x0', hash, number: -1, status: 'pruned' })
            }
            for (const hash of finalizedBlockHashes) {
              blocks.push({ parent: '0x0', hash, number: -1, status: 'finalized' })
            }
            break
          }
        }
        return blocks
      }),
      filter((x) => x !== null),
      retryOnStopError(),
    )
  }

  constructor(log: Logger, chainId: string, url: string | Array<string>) {
    super()

    this.chainId = chainId

    this.#log = log
    // for the type checking... find a cleaner way :/
    this.#wsProvider = getWsProvider(url, {
      websocketClass: WS as unknown as WebSocketClass,
      innerEnhancer: withLegacy(),
      timeout: 5_000,
    })

    const substrateClient = createClient(this.#wsProvider)

    // TODO: enable when there's more support
    // this.getChainSpecData = substrateClient.getChainSpecData
    this.#client = getObservableClient(substrateClient)
    this.#head = this.#client.chainHead$()
    this.#rpc = createRpcApi(chainId, substrateClient.request)
    this.#runtimeManager = createRuntimeManager({
      chainId: this.chainId,
      runtime$: this.#head.runtime$,
      log: this.#log,
      rpc: this.#rpc,
    })
  }

  async ctx(specVersion?: number) {
    return specVersion === undefined
      ? this.#runtimeManager.getCurrent()
      : this.#runtimeManager.getByVersion(specVersion)
  }

  followHeads$(finality = 'finalized'): Observable<NeutralHeader> {
    return (finality === 'finalized' ? this.#finalized$ : this.#new$).pipe(
      map((b) => ({
        hash: b.hash,
        height: b.number ?? -1,
        parenthash: b.parent ?? '0x0',
        status: b.status,
      })),
    )
  }

  async isReady(): Promise<SubstrateApi> {
    if (this.#connected) {
      return Promise.resolve(this)
    }
    return new Promise<SubstrateApi>((resolve) => this.once('connected', () => resolve(this)))
  }

  async getMetadata(): Promise<Uint8Array> {
    try {
      return (await this.#runtimeManager.getCurrent()).metadataRaw
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch metadata.`, { cause: error })
    }
  }

  async getRuntimeVersion() {
    return await getRuntimeVersion(await this.ctx())
  }

  async getChainSpecData() {
    return this.#rpc.getChainSpecData()
  }

  async getBlockHeader(hash: string) {
    return this.#rpc.getBlockHeader(hash)
  }

  async getNeutralBlockHeader(hash: string) {
    const header = await this.getBlockHeader(hash)
    return {
      parenthash: header.parent,
      hash: header.hash,
      height: header.number,
    }
  }

  async getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey?: string,
    at?: string,
  ): Promise<HexString[]> {
    return this.#rpc.getStorageKeys(keyPrefix, count, resolvedStartKey, at)
  }

  async getStorage(key: string, at?: string) {
    return this.#rpc.getStorage(key, at)
  }

  async query<T = any>(
    ops: { module: string; method: string; at?: string },
    ...args: any[]
  ): Promise<T | null> {
    const { module, method, at } = ops
    try {
      const codec = (await this.ctx()).storageCodec<T>(module, method)
      const key = codec.keys.enc(...args)
      const data = await this.getStorage(key, at)
      return data !== null ? codec.value.dec(data) : null
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to query ${module}.${method}.`, { cause: error })
    }
  }

  async *queryByPrefixPaginated<T = any>(
    {
      module,
      method,
      pageSize = 10,
      at,
    }: {
      module: string
      method: string
      pageSize?: number
      at?: string
    },
    ...args: any[]
  ): AsyncGenerator<{ keyArgs: any[]; value: T }, void, void> {
    try {
      const codec = (await this.ctx()).storageCodec<T>(module, method)
      const prefix = codec.keys.enc(...args)
      let startKey: string | undefined = undefined

      while (true) {
        const keys = await this.getStorageKeys(prefix, pageSize, startKey, at)
        if (keys.length === 0) {
          break
        }

        for (const key of keys) {
          const data = await this.getStorage(key, at)
          if (data !== null) {
            yield {
              keyArgs: codec.keys.dec(key),
              value: codec.value.dec(data),
            }
          }
        }

        if (keys.length < pageSize) {
          break
        }
        startKey = keys[keys.length - 1]
      }
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to query ${module}.${method}.`, { cause: error })
    }
  }

  async queryStorageAt(keys: string[], at?: string) {
    return this.#rpc.queryStorageAt(keys, at)
  }

  async runtimeCall<T = any>({ api, method, at }: { api: string; method: string; at?: string }, args: any[]) {
    try {
      const atHash = at ?? null
      const codec = (await this.ctx()).runtimeCallCodec<T>(api, method)
      const encodedArgs = codec.args.enc(args)
      const data = await firstValueFrom(this.#head.call$(atHash, `${api}_${method}`, toHex(encodedArgs)))
      return data ? codec.value.dec(data) : null
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to call ${api}.${method}. args=${args}`, {
        cause: error,
      })
    }
  }

  async connect() {
    this.#runtimeManager
      .init()
      .then(() => {
        super.emit('connected')
        this.#connected = true
      })
      .catch((error) => {
        this.#log.error(error, '[client:%s] error while connecting', this.chainId)
      })
    return this.isReady()
  }

  async disconnect() {
    try {
      this.#head.unfollow()
    } catch {
      //
    } finally {
      this.#client.destroy()
    }
  }

  async getRpcMethods() {
    return this.#rpc.getRpcMethods()
  }

  getBlockHash(height: number): Promise<string> {
    return this.#rpc.getBlockHash(height)
  }

  async getBlock(hash: string, isFollowing = true): Promise<Block> {
    try {
      const runtimeCtx = isFollowing ? await this.ctx() : await this.#runtimeManager.getRuntimeForBlock(hash)
      const specVersion = (await getRuntimeVersion(runtimeCtx))?.specVersion
      const [block, events] = await Promise.all([this.#rpc.getBlock(hash), this.#getEvents(hash, runtimeCtx)])
      return asSerializable({
        hash,
        specVersion,
        number: BigInt(block.header.number).toString(),
        parent: block.header.parentHash,
        stateRoot: block.header.stateRoot,
        extrinsicsRoot: block.header.extrinsicsRoot,
        digest: block.header.digest,
        extrinsics: block.extrinsics.map((tx) => runtimeCtx.decodeExtrinsic(tx)),
        events,
      }) as Block
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block ${hash}.`, { cause: error })
    }
  }

  async #getEvents(hash: string, ctx: RuntimeApiContext | SubstrateApiContext) {
    try {
      const eventsData = await this.getStorage((ctx ?? this.ctx).events.key, hash)

      if (!eventsData) {
        return []
      }

      const systemEvents: SystemEvent[] = (ctx ?? this.ctx).events.dec(eventsData)
      return systemEvents.map(({ phase, topics, event }) => ({
        phase,
        topics,
        event: {
          module: event.type,
          name: event.value.type,
          value: event.value.value,
        },
      }))
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch events for hash ${hash}.`, { cause: error })
    }
  }
}

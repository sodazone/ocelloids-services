import { EventEmitter } from 'node:events'
import { Observable, filter, map, mergeMap, of, retry, skip } from 'rxjs'

import { ChainHead$, SystemEvent, getObservableClient } from '@polkadot-api/observable-client'
import { StopError, createClient } from '@polkadot-api/substrate-client'
import {
  fixDescendantValues,
  fixUnorderedEvents,
  parsed,
  patchChainHeadEvents,
  translate,
  unpinHash,
} from 'polkadot-api/polkadot-sdk-compat'
import { WsJsonRpcProvider, getWsProvider } from 'polkadot-api/ws-provider/node'

import { asSerializable } from '@/common/index.js'

import { HexString } from '../../subscriptions/types.js'
import { Logger } from '../../types.js'
import { NeutralHeader } from '../types.js'
import { RuntimeApiContext, createRuntimeApiContext } from './context.js'
import { RpcApi, createRpcApi } from './rpc.js'
import { RuntimeManager, createRuntimeManager, getRuntimeVersion } from './runtime.js'
import { Block, BlockInfoWithStatus, SubstrateApi, SubstrateApiContext } from './types.js'

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

  #apiContext!: () => SubstrateApiContext
  #runtimeManager: RuntimeManager

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
    this.#wsProvider = Array.isArray(url) ? getWsProvider(url) : getWsProvider(url)

    const withCompat = parsed(
      // withNumericIds,
      translate,
      fixUnorderedEvents,
      unpinHash,
      patchChainHeadEvents,
      // fixPrematureBlocks,
      // fixUnorderedBlocks,
      // fixChainSpec,
      fixDescendantValues,
    )

    const substrateClient = createClient(withCompat(this.#wsProvider))

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

    this.#apiContext = () => {
      throw new Error(`[${this.chainId}] Runtime context not initialized. Try using awaiting isReady().`)
    }
  }

  get ctx() {
    return this.#apiContext()
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
      return this
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
    return await getRuntimeVersion(this.ctx)
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

  async query<T = any>(module: string, method: string, ...args: any[]) {
    try {
      const codec = this.ctx.storageCodec<T>(module, method)
      const data = await this.getStorage(codec.keys.enc(...args))
      return data !== null ? codec.value.dec(data) : null
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to query ${module}.${method}.`, { cause: error })
    }
  }

  connect() {
    this.#runtimeManager
      .init()
      .then((ctx) => {
        this.#apiContext = () => ctx
        super.emit('connected')
        this.#connected = true
        this.#subscribeToRuntimeUpgrades()
      })
      .catch((error) => {
        this.#log.error(error, '[client:%s] error while connecting', this.chainId)
      })
    return this.isReady()
  }

  disconnect() {
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
      const runtimeCtx = isFollowing ? this.ctx : await this.#runtimeManager.getRuntimeForBlock(hash)
      const [block, events] = await Promise.all([this.#rpc.getBlock(hash), this.#getEvents(hash, runtimeCtx)])
      return asSerializable({
        hash,
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

  #subscribeToRuntimeUpgrades() {
    // TODO: probably a race condition with the finalized stream.
    // Check this out, to use the runtime from pinned blocks or blocks with runtime.
    // We don't want to add an additional call to get the spec version
    // per block (we do it only for backfills)
    this.#runtimeManager.runtime$.pipe(skip(1)).subscribe((runtime) => {
      const ctx = createRuntimeApiContext(runtime.metadataRaw, this.chainId)
      this.#runtimeManager.updateCache(ctx)
    })
  }
}

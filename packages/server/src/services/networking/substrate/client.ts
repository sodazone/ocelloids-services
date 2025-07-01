import { EventEmitter } from 'node:events'
import {
  Observable,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  of,
  race,
  retry,
  shareReplay,
  take,
  timer,
} from 'rxjs'

import { BlockInfo, ChainHead$, SystemEvent, getObservableClient } from '@polkadot-api/observable-client'
import { ChainSpecData, StopError, createClient } from '@polkadot-api/substrate-client'
import {
  fixDescendantValues,
  fixUnorderedEvents,
  parsed,
  patchChainHeadEvents,
  translate,
  unpinHash,
} from 'polkadot-api/polkadot-sdk-compat'
import { fromHex } from 'polkadot-api/utils'
import { WsJsonRpcProvider, getWsProvider } from 'polkadot-api/ws-provider/node'

import { asSerializable } from '@/common/index.js'

import { HexString } from '../../subscriptions/types.js'
import { Logger } from '../../types.js'
import { NeutralHeader } from '../types.js'
import { RuntimeApiContext, createRuntimeApiContext } from './context.js'
import { Block, BlockInfoWithStatus, SubstrateApi, SubstrateApiContext } from './types.js'

const RUNTIME_STREAM_TIMEOUT_MILLIS = 20_000

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
  readonly #request: <Reply = any, Params extends Array<any> = any[]>(
    method: string,
    params: Params,
  ) => Promise<Reply>
  readonly #head: ChainHead$

  #sharedRuntime$?: Observable<any>
  #runtimeContextCache?: Promise<RuntimeApiContext>

  #apiContext!: () => SubstrateApiContext

  get _sharedRuntime$(): Observable<any> {
    if (!this.#sharedRuntime$) {
      this.#sharedRuntime$ = this.#head.runtime$.pipe(
        filter(Boolean),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
    }
    return this.#sharedRuntime$
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
    this.#request = substrateClient.request
    this.#head = this.#client.chainHead$()

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

  get #runtimeContext(): Promise<RuntimeApiContext> {
    if (this.#runtimeContextCache === undefined) {
      this.#runtimeContextCache = this.#loadRuntimeContext()
    }
    return this.#runtimeContextCache
  }

  async #loadRuntimeContext(): Promise<RuntimeApiContext> {
    try {
      return await firstValueFrom(
        race([
          this._sharedRuntime$.pipe(
            filter(Boolean),
            take(1),
            map((runtime) => new RuntimeApiContext(runtime, this.chainId)),
          ),
          timer(RUNTIME_STREAM_TIMEOUT_MILLIS).pipe(
            mergeMap(async () => {
              this.#log.warn('[%s] Fallback to state_getMetadata', this.chainId)
              const metadata = await this.#getMetadata()
              return createRuntimeApiContext(fromHex(metadata), this.chainId)
            }),
          ),
        ]),
      )
    } catch (err) {
      this.#runtimeContextCache = undefined
      throw err
    }
  }

  async isReady(): Promise<SubstrateApi> {
    if (this.#connected) {
      return this
    }
    return new Promise<SubstrateApi>((resolve) => this.once('connected', () => resolve(this)))
  }

  async getMetadata(): Promise<Uint8Array> {
    try {
      return (await this.#runtimeContext).metadataRaw
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch metadata.`, { cause: error })
    }
  }

  async getRuntimeVersion() {
    return (await this.ctx.getConstant('System', 'Version')) as {
      specName: string
      implName: string
      authoringVersion: number
      specVersion: number
      implVersion: number
    }
  }

  async getChainSpecData() {
    try {
      const [name, genesisHash, properties] = await Promise.all([
        this.#request<string>('system_chain', []),
        this.#request<string>('chain_getBlockHash', [0]),
        this.#request<{
          ss58Format?: string | null
          isEthereum: boolean
          tokenSymbol: string[] | string
          tokenDecimals: number[] | number
        }>('system_properties', []),
      ])
      return {
        name,
        genesisHash,
        properties,
      } as ChainSpecData
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to retrieve system properties.`, { cause: error })
    }
  }

  async getBlock(hash: string): Promise<Block> {
    try {
      const [block, events] = await Promise.all([this.#getBlock(hash), this.#getEvents(hash)])
      return asSerializable({
        hash,
        number: BigInt(block.header.number).toString(),
        parent: block.header.parentHash,
        stateRoot: block.header.stateRoot,
        extrinsicsRoot: block.header.extrinsicsRoot,
        disgest: block.header.digest,
        extrinsics: block.extrinsics.map((tx) => this.ctx.decodeExtrinsic(tx)),
        events,
      }) as Block
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block ${hash}.`, { cause: error })
    }
  }

  async getBlockHash(blockNumber: string | number | bigint): Promise<string> {
    try {
      const result = await this.#request<string, [height: string]>('chain_getBlockHash', [
        '0x' + Number(blockNumber).toString(16),
      ])
      if (result === null) {
        throw new Error('Block hash not found')
      }
      return result
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block hash.`, { cause: error })
    }
  }

  async getBlockHeader(hash: string): Promise<BlockInfo> {
    try {
      const header = await this.#request<{ parentHash: string; number: string }, [hash: string]>(
        'chain_getHeader',
        [hash],
      )
      return {
        parent: header.parentHash,
        hash,
        number: Number(BigInt(header.number)),
      }
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch header for hash ${hash}.`, { cause: error })
    }
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
    try {
      return await this.#request<HexString[]>('state_getKeysPaged', [keyPrefix, count, resolvedStartKey, at])
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch storage keys.`, { cause: error })
    }
  }

  async getStorage(key: string, at?: string) {
    try {
      return await this.#request<HexString>('state_getStorage', [key, at])
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch storage for key ${key}.`, { cause: error })
    }
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
    this.#runtimeContext
      .then((ctx) => {
        this.#apiContext = () => ctx
        super.emit('connected')
        this.#connected = true
      })
      .catch((error) => {
        this.#log.error(error, '[client:%s] error while connecting (should never happen)', this.chainId)
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
    try {
      return await this.#request<{ methods: string[] }>('rpc_methods', [])
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch RPC methods.`, { cause: error })
    }
  }

  async #getMetadata() {
    try {
      return await this.#request<string>('state_getMetadata', [])
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch metadata.`, { cause: error })
    }
  }

  async #getBlock(hash: string) {
    try {
      const result = await this.#request<
        {
          block: {
            header: {
              parentHash: string
              number: string
              stateRoot: string
              extrinsicsRoot: string
              digest?: {
                logs: any[]
              }
            }
            extrinsics: string[]
          }
        },
        [hash: string]
      >('chain_getBlock', [hash])
      return result?.block
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block body for hash ${hash}.`, {
        cause: error,
      })
    }
  }

  async #getEvents(hash: string) {
    try {
      const eventsData = await this.getStorage(this.ctx.events.key, hash)

      if (!eventsData) {
        return []
      }

      const systemEvents: SystemEvent[] = this.ctx.events.dec(eventsData)
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

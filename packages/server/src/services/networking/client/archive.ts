import { EventEmitter } from 'node:events'
import { filter, firstValueFrom } from 'rxjs'

import {
  BlockInfo,
  ChainHead$,
  RuntimeContext,
  SystemEvent,
  getObservableClient,
} from '@polkadot-api/observable-client'
import { blockHeader } from '@polkadot-api/substrate-bindings'
import { ChainSpecData, createClient } from '@polkadot-api/substrate-client'
import {
  fixDescendantValues,
  fixPrematureBlocks,
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
import { Block } from '../types.js'
import { RuntimeApiContext } from './context.js'
import { ApiClient, ApiContext } from './types.js'

export async function createArchiveClient(log: Logger, chainId: string, url: string | Array<string>) {
  const client = new ArchiveClient(log, chainId, url)
  return await client.connect()
}

/**
 * Archive Substrate API client.
 */
export class ArchiveClient extends EventEmitter implements ApiClient {
  #connected: boolean = false
  readonly chainId: string

  readonly #log: Logger
  readonly #wsProvider: WsJsonRpcProvider
  readonly #client: { chainHead$: () => ChainHead$; destroy: () => void }
  readonly #request: <Reply = any, Params extends Array<any> = any[]>(
    method: string,
    params: Params,
  ) => Promise<Reply>
  readonly #head$: ChainHead$
  #apiContext!: () => ApiContext

  get ctx() {
    return this.#apiContext()
  }

  get finalizedHeads$() {
    return this.#head$.finalized$
  }

  get #runtimeContext(): Promise<RuntimeContext> {
    return firstValueFrom(this.#head$.runtime$.pipe(filter(Boolean)))
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
    this.#head$ = this.#client.chainHead$()

    this.#apiContext = () => {
      throw new Error(`[${this.chainId}] Runtime context not initialized. Try using awaiting isReady().`)
    }
  }

  async isReady(): Promise<ApiClient> {
    if (this.#connected) {
      return this
    }
    return new Promise<ApiClient>((resolve) => this.once('connected', () => resolve(this)))
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
          ss58Format?: string
          SS58Prefix: number
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
      const [header, txs, events] = await Promise.all([
        this.getHeader(hash),
        this.#getBody(hash),
        this.#getEvents(hash),
      ])

      return asSerializable({
        hash,
        number: header.number,
        parent: header.parent,
        extrinsics: txs.map((tx) => this.ctx.decodeExtrinsic(tx)),
        events,
      }) as Block
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block ${hash}.`, { cause: error })
    }
  }

  async getBlockHash(blockNumber: string | number | bigint): Promise<string> {
    try {
      const result = await this.#request<string[], [height: number]>('archive_unstable_hashByHeight', [
        Number(blockNumber),
      ])
      if (!result || result.length < 1) {
        throw new Error('Block hash not found')
      }
      return result[0]
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block hash.`, { cause: error })
    }
  }

  async getHeader(hash: string): Promise<BlockInfo> {
    try {
      const encodedHeader = await this.#request<string, [hash: string]>('archive_unstable_header', [hash])
      const header = blockHeader.dec(encodedHeader)
      return {
        parent: header.parentHash,
        hash,
        number: header.number,
      }
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch header for hash ${hash}.`, { cause: error })
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
      const data = await this.getStorage(codec.enc(...args))
      return codec.dec(data)
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to query ${module}.${method}.`, { cause: error })
    }
  }

  connect() {
    this.#runtimeContext
      .then((x) => {
        const ctx = new RuntimeApiContext(x, this.chainId)
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
      this.#head$.unfollow()
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

  async #getBody(hash: string) {
    try {
      const result = await this.#request<[tx: string], [hash: string]>('archive_unstable_body', [hash])
      return result
    } catch (error) {
      throw new Error(`[client:${this.chainId}] Failed to fetch block body for hash ${hash}.`, {
        cause: error,
      })
    }
  }

  async #getEvents(hash: string) {
    try {
      const response = await this.#request<
        { result: [{ key: string; value: string }] },
        [hash: string, items: [{ key: string; type: string }], null]
      >('archive_unstable_storage', [hash, [{ key: this.ctx.events.key, type: 'value' }], null])

      const eventsData = response.result?.[0]?.value
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

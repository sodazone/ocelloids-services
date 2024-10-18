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
import { ChainSpecData, SubstrateClient, createClient } from '@polkadot-api/substrate-client'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { WsJsonRpcProvider, getWsProvider } from 'polkadot-api/ws-provider/node'

import { HexString } from '../subscriptions/types.js'
import { ApiContext } from './context.js'
import { Block, EventRecord } from './types.js'

export class ApiClient extends EventEmitter {
  readonly isReady: () => Promise<ApiClient>
  get ctx() {
    return this.#apiContext()
  }
  get finalizedHeads$() {
    return this.#head$.finalized$
  }
  readonly getChainSpecData: () => Promise<ChainSpecData>

  readonly #wsProvider: WsJsonRpcProvider
  readonly #client: { chainHead$: () => ChainHead$; destroy: () => void }
  readonly #request: <Reply = any, Params extends Array<any> = any[]>(
    method: string,
    params: Params,
  ) => Promise<Reply>
  readonly #head$: ChainHead$

  get #runtimeContext(): Promise<RuntimeContext> {
    return firstValueFrom(this.#head$.runtime$.pipe(filter(Boolean)))
  }
  #apiContext: () => ApiContext

  constructor(url: string | Array<string>) {
    super()

    this.#wsProvider = Array.isArray(url) ? getWsProvider(url) : getWsProvider(url)

    const substrateClient: SubstrateClient = createClient(withPolkadotSdkCompat(this.#wsProvider))
    this.getChainSpecData = substrateClient.getChainSpecData
    this.#client = getObservableClient(substrateClient)
    this.#request = substrateClient.request
    this.#head$ = this.#client.chainHead$()

    this.#apiContext = () => {
      throw new Error('Runtime context not initialized')
    }

    this.isReady = () =>
      new Promise<ApiClient>((resolve) => {
        this.once('connected', () => resolve(this))
      })
  }

  async getMetadata(): Promise<Uint8Array> {
    return (await this.#runtimeContext).metadataRaw
  }

  async getRuntimeVersion() {
    return (await this.ctx.getConstant('system', 'version')) as {
      specName: string
      implName: string
      authoringVersion: number
      specVersion: number
      implVersion: number
    }
  }

  async getBlock({ hash, number }: { hash: string; number: number }): Promise<Block> {
    const [txs, events] = await Promise.all([this.#getBody(hash), await this.#getEvents(hash)])

    return {
      hash,
      number,
      extrinsics: txs.map((tx) => this.ctx.decodeExtrinsic(tx)),
      events,
    }
  }

  async getBlockHash(blockNumber: string): Promise<string> {
    return await this.#request<string, [height: string]>('archive_unstable_hashByHeight', [blockNumber])
  }

  async getHeader(hash: string): Promise<BlockInfo> {
    const header = blockHeader.dec(
      await this.#request<string, [hash: string]>('archive_unstable_header', [hash]),
    )
    return {
      parent: header.parentHash,
      hash,
      number: header.number,
    }
  }

  async connect() {
    try {
      console.log('Connecting')
      const ctx = new ApiContext(await this.#runtimeContext)
      console.log('connected')
      this.#apiContext = () => ctx
      super.emit('connected')
    } catch (error) {
      console.log(error)
      setTimeout(() => {
        console.log('switching provider')
        this.#wsProvider.switch()
      }, 5000).unref()
    }
  }

  async getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey: string | undefined,
    at: string | undefined,
  ): Promise<HexString[]> {
    return await this.#request<HexString[]>('state_getKeysPaged', [keyPrefix, count, resolvedStartKey, at])
  }

  async getStorage(key: string, at?: string) {
    return await this.#request<HexString>('state_getStorage', [key, at])
  }

  async query<T = any>(module: string, method: string, ...args: any[]) {
    const codec = this.ctx.storageCodec<T>(module, method)
    return codec.dec(await this.getStorage(codec.enc(...args)))
  }

  disconnect() {
    this.#head$.unfollow()
    this.#client.destroy()
  }

  async #getBody(hash: string) {
    return await this.#request<[tx: string], [hash: string]>('archive_unstable_body', [hash])
  }

  async #getEvents(hash: string) {
    const events: SystemEvent[] =
      this.ctx.events.dec(
        (
          await this.#request<
            {
              result: [
                {
                  key: string
                  value: string
                },
              ]
            },
            [
              hash: string,
              items: [
                {
                  key: string
                  type: string
                },
              ],
              childTrie: null,
            ]
          >('archive_unstable_storage', [
            hash,
            [
              {
                key: this.ctx.events.key,
                type: 'value',
              },
            ],
            null,
          ])
        ).result[0]?.value,
      ) ?? []

    return events.map(
      ({ phase, topics, event }) =>
        ({
          phase,
          topics,
          event: {
            module: event.type,
            name: event.value.type,
            value: event.value.value,
          },
        }) as EventRecord,
    )
  }
}

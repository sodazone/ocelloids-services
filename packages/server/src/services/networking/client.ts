import { EventEmitter } from 'node:events'
import { firstValueFrom } from 'rxjs'

import { BlockInfo, ChainHead$, getObservableClient } from '@polkadot-api/observable-client'
import { Bytes, Option, blockHeader, u32 } from '@polkadot-api/substrate-bindings'
import { ChainSpecData, SubstrateClient, createClient } from '@polkadot-api/substrate-client'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { toHex } from 'polkadot-api/utils'
import { getWsProvider } from 'polkadot-api/ws-provider/node'

import { HexString } from '../subscriptions/types.js'
import { ApiContext } from './context.js'
import { Block, EventRecord } from './types.js'

const argV15 = toHex(u32.enc(15))

type RawEvent = {
  type: string
  value: {
    type: string
    value: Record<string, any>
  }
}

export class ApiClient extends EventEmitter {
  readonly #client: { chainHead$: () => ChainHead$; destroy: () => void }
  readonly #request: <Reply = any, Params extends Array<any> = any[]>(
    method: string,
    params: Params,
  ) => Promise<Reply>
  readonly getChainSpecData: () => Promise<ChainSpecData>

  #ctx: () => ApiContext
  #head$: ChainHead$

  isReady: () => Promise<ApiClient>

  constructor(url: string | Array<string>) {
    super()

    const provider = Array.isArray(url) ? getWsProvider(url) : getWsProvider(url)

    const substrateClient: SubstrateClient = createClient(withPolkadotSdkCompat(provider))
    this.getChainSpecData = substrateClient.getChainSpecData
    this.#client = getObservableClient(substrateClient)
    this.#request = substrateClient.request
    this.#head$ = this.#client.chainHead$()

    this.#ctx = () => {
      throw new Error('Runtime context not initialized')
    }

    this.isReady = () =>
      new Promise<ApiClient>((resolve) => {
        this.once('connected', () => resolve(this))
      })
  }

  get ctx() {
    return this.#ctx()
  }

  async getMetadata(): Promise<Uint8Array> {
    return await this.#getMetadataAtVersion()
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

  get finalizedHeads$() {
    return this.#head$.finalized$
  }

  async connect() {
    // TODO init metadata configurable, could come from redis
    // TODO: reliable connection and retry
    try {
      const { metadataRaw } = await firstValueFrom(this.#head$.getRuntimeContext$(null))
      const ctx = new ApiContext(metadataRaw)
      this.#ctx = () => ctx
      super.emit('connected')
    } catch (error) {
      // TODO: emit error and reconnect switch?
      console.log(error)
      this.#head$.unfollow()
      setTimeout(() => {
        this.#head$ = this.#client.chainHead$()
      }, 5000).unref()
    }
  }

  async #getMetadataAtVersion(version = argV15) {
    const finalized = await firstValueFrom(this.finalizedHeads$)
    const response = await this.#request<{
      result: HexString
    }>('archive_unstable_call', [finalized.hash, 'Metadata_metadata_at_version', version])

    const bytes = Option(Bytes())
    const metadata = bytes.dec(response.result)

    if (metadata === undefined) {
      throw new Error('Error retrieving metadata')
    }

    return metadata
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
    const events: EventRecord<RawEvent>[] =
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

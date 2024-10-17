import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { BlockInfo, ChainHead$, getObservableClient } from '@polkadot-api/observable-client'
import {
  Bin,
  Bytes,
  Option,
  Tuple,
  V14,
  blockHeader,
  compact,
  decAnyMetadata,
  u32,
} from '@polkadot-api/substrate-bindings'
import { ChainSpecData, SubstrateClient, createClient } from '@polkadot-api/substrate-client'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { fromHex, toHex } from 'polkadot-api/utils'
import { getWsProvider } from 'polkadot-api/ws-provider/node'

import { firstValueFrom } from 'rxjs'

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

export class ApiClient {
  #client: { chainHead$: () => ChainHead$; destroy: () => void }
  #request: <Reply = any, Params extends Array<any> = any[]>(method: string, params: Params) => Promise<Reply>
  #ctx: () => ApiContext
  #head$: ChainHead$

  getChainSpecData: () => Promise<ChainSpecData>

  constructor(url: string | Array<string>) {
    const provider = Array.isArray(url) ? getWsProvider(url) : getWsProvider(url)

    const substrateClient: SubstrateClient = createClient(withPolkadotSdkCompat(provider))
    this.getChainSpecData = substrateClient.getChainSpecData
    this.#client = getObservableClient(substrateClient)
    this.#request = substrateClient.request
    this.#head$ = this.#client.chainHead$()

    this.#ctx = () => {
      throw new Error('Runtime context not initialized')
    }
  }

  get ctx() {
    return this.#ctx()
  }

  async getMetadata(): Promise<Uint8Array> {
    // TODO: try catch with ctx() first?
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

  async v14(finalized: BlockInfo) {
    // V14
    const response = await this.#request<{
      result: HexString
    }>('archive_unstable_call', [finalized.hash, 'Metadata_metadata', ''])
    const metadataBytes = Tuple(compact, Bin(Infinity)).dec(response.result)[1].asBytes()
    const { metadata } = decAnyMetadata(metadataBytes)
    if (metadata.tag !== 'v14') {
      throw new Error('Only v15 is supported for the time being')
    }

    const v14 = metadata.value as V14

    const extrinsicDecode = getExtrinsicDecoder(metadataBytes)
    const lookup = getLookupFn(v14)
    const dynamicBuilder = getDynamicBuilder(lookup)

    //
    // const callDec = Struct.dec({module: u8.dec, function: u8.dec, callArgs: Bin(Infinity).dec })
    // const xx = callDec(xt.callData.asBytes())
    // console.log(xx, this.#lookup.metadata.pallets.find(p => p.index === xx.module))
    // get pallet and function by index, so you can decode
  }

  async connect() {
    // TODO init metadata configurable, could come from redis
    // this.v14(finalized)

    const metadataBytes = await this.#getMetadataAtVersion()
    const ctx = new ApiContext(metadataBytes)
    this.#ctx = () => ctx
  }

  async #getMetadataAtVersion(version = argV15) {
    const finalized = await firstValueFrom(this.finalizedHeads$)
    const response = await this.#request<{
      result: HexString
    }>('archive_unstable_call', [finalized.hash, 'Metadata_metadata_at_version', version])

    const ov15 = Option(Bytes())
    return ov15.dec(response.result)!
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

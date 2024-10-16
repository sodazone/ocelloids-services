import { MetadataLookup, getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { BlockInfo } from '@polkadot-api/observable-client'
import {
  Bin,
  Binary,
  Bytes,
  Codec,
  Decoder,
  Option,
  Tuple,
  V14,
  V15,
  blockHeader,
  compact,
  decAnyMetadata,
  u32,
} from '@polkadot-api/substrate-bindings'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { PolkadotClient, createClient } from 'polkadot-api'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { fromHex, toHex } from 'polkadot-api/utils'
import { getWsProvider } from 'polkadot-api/ws-provider/node'

import { HexString } from '../subscriptions/types.js'

type Call = { type: string; value: { type: string; value: unknown } }
type RawEvent = {
  type: string
  value: {
    type: string
    value: Record<string, any>
  }
}

export type Event = {
  module: string
  name: string
  value: Record<string, any>
}
export type EventRecord<T = Event> = {
  phase: {
    type: string
    value: number
  }
  event: T
  topics: any[]
}

export type Extrinsic = {
  module: string
  method: string
  signed: boolean
  signature: any
  address: any
  args: Record<string, any>
}

export type Block = {
  hash: string
  number: number
  extrinsics: Extrinsic[]
  events: EventRecord[]
}

const argV15 = toHex(u32.enc(15))

export class RuntimeContext {
  #extrinsicDecode: any
  #dynamicBuilder: any
  #callCodec: any
  #lookup: MetadataLookup

  events: {
    key: HexString
    dec: any
  }

  constructor(metadataBytes: Uint8Array) {
    const { metadata } = decAnyMetadata(metadataBytes)
    if (metadata.tag !== 'v15') {
      throw new Error('Only v15 is supported for the time being')
    }

    const v15 = metadata.value as V15

    this.#extrinsicDecode = getExtrinsicDecoder(metadataBytes)
    this.#lookup = getLookupFn(v15)
    this.#dynamicBuilder = getDynamicBuilder(this.#lookup)
    this.#callCodec = this.#dynamicBuilder.buildDefinition(v15.extrinsic.call) as Codec<Call>

    const events = this.#dynamicBuilder.buildStorage('System', 'Events')
    this.events = {
      key: events.enc(),
      dec: events.dec as any,
    }
  }

  hasPallet(name: string) {
    return this.#lookup.metadata.pallets.findIndex((p) => p.name === name) > -1
  }

  getTypeIdByPath(path: string | string[]): number | undefined {
    const target = Array.isArray(path) ? path.join('.').toLowerCase() : path
    return this.#lookup.metadata.lookup.find((ty) => ty.path.join('.').toLowerCase() === target)?.id
  }

  decodeExtrinsic(hextBytes: string): Extrinsic {
    const xt: {
      callData: Binary
      signed: boolean
      address?: any
      signature?: any
    } = this.#extrinsicDecode(hextBytes)
    const call = this.#callCodec.dec(xt.callData.asBytes())
    return {
      module: call.type,
      method: call.value.type,
      args: call.value.value,
      signed: xt.signed,
      address: xt.address,
      signature: xt.signature,
    }
  }

  storageCodec<T = any>(module: string, method: string) {
    return this.#dynamicBuilder.buildStorage(module, method) as {
      enc: (...args: any[]) => string
      dec: Decoder<T>
      keyDecoder: (value: string) => any[]
    }
  }

  typeCodec<T = any>(path: string | string[]): Codec<T> {
    const id = this.getTypeIdByPath(path)
    if (id === undefined) {
      throw new Error(`type not found: ${path}`)
    }

    return this.#dynamicBuilder.buildDefinition(id) as Codec<T>
  }

  getConstant(palletName: string, name: string) {
    const pallet = this.#lookup.metadata.pallets.find((p) => p.name === palletName)
    const constant = pallet?.constants.find((c) => c.name === name)

    return constant === undefined
      ? undefined
      : this.#dynamicBuilder.buildConstant(palletName, name).dec(constant.value)
  }
}

// TODO: isReady to wait until metadata...
export class PapiClient {
  #client: PolkadotClient
  #ctx: () => RuntimeContext

  constructor(url: string | Array<string>) {
    const provider = Array.isArray(url) ? getWsProvider(url) : getWsProvider(url)

    this.#client = createClient(withPolkadotSdkCompat(provider))
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

  async getSignedBlockFromHash({ hash, number }: { hash: string; number: number }): Promise<Block> {
    // TBD: in parallel
    const txs = await this.#getBody(hash)
    const events = await this.#getEvents(hash)

    return {
      hash,
      number,
      extrinsics: txs.map((tx) => this.ctx.decodeExtrinsic(tx)),
      events,
    }
  }

  async getBlockHash(blockNumber: string): Promise<string> {
    return await this.#client._request<string, [height: string]>('archive_unstable_hashByHeight', [
      blockNumber,
    ])
  }

  async getHeader(hash: string): Promise<BlockInfo> {
    const header = blockHeader.dec(
      await this.#client._request<string, [hash: string]>('archive_unstable_header', [hash]),
    )
    return {
      parent: header.parentHash,
      hash,
      number: header.number,
    }
  }

  get finalizedHeads$() {
    return this.#client.finalizedBlock$
  }

  async v14(finalized: BlockInfo) {
    // V14
    const response = await this.#client._request<{
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
    const ctx = new RuntimeContext(metadataBytes)
    this.#ctx = () => ctx
  }

  async #getMetadataAtVersion(version = argV15) {
    const finalized = await this.#client.getFinalizedBlock()
    const response = await this.#client._request<{
      result: HexString
    }>('archive_unstable_call', [finalized.hash, 'Metadata_metadata_at_version', version])

    const ov15 = Option(Bytes())
    return ov15.dec(response.result)!
  }

  async getChainSpecData() {
    return await this.#client.getChainSpecData()
  }

  async getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey: string | undefined,
    at: string | undefined,
  ): Promise<HexString[]> {
    return await this.#client._request<HexString[]>('state_getKeysPaged', [
      keyPrefix,
      count,
      resolvedStartKey,
      at,
    ])
  }

  async getStorage(key: string, at?: string) {
    return fromHex(await this.#client._request<HexString>('state_getStorage', [key, at]))
  }

  async query<T = any>(module: string, method: string, ...args: any[]) {
    const codec = this.ctx.storageCodec<T>(module, method)
    return codec.dec(await this.getStorage(codec.enc(...args)))
  }

  disconnect() {
    this.#client.destroy()
  }

  async #getBody(hash: string) {
    return await this.#client._request<[tx: string], [hash: string]>('archive_unstable_body', [hash])
  }

  async #getEvents(hash: string) {
    const events: EventRecord<RawEvent>[] =
      this.ctx.events.dec(
        (
          await this.#client._request<
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

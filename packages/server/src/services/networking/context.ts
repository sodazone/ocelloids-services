import { RuntimeContext, SystemEvent } from '@polkadot-api/observable-client'
import { Decoder } from '@polkadot-api/substrate-bindings'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { Binary, Codec } from 'polkadot-api'

import { Extrinsic, StorageCodec } from './types.js'

type Call = { type: string; value: { type: string; value: any } }

export class ApiContext {
  readonly #extrinsicDecoder: Decoder<
    | {
        len: number
        signed: false
        version: number
        callData: Binary
      }
    | {
        address: any
        signature: any
        extra: Record<string, any>
        callData: Binary
        len: number
        signed: true
        version: number
      }
  >
  readonly #callCodec: Codec<Call>
  readonly #runtimeContext: RuntimeContext

  get #metadata() {
    return this.#runtimeContext.lookup.metadata
  }

  get #builder() {
    return this.#runtimeContext.dynamicBuilder
  }

  get events() {
    return this.#runtimeContext.events
  }

  constructor(runtimeContext: RuntimeContext) {
    const { lookup } = runtimeContext
    if (!('call' in lookup.metadata.extrinsic)) {
      throw new Error('Only metadata v15 is supported')
    }

    this.#runtimeContext = runtimeContext
    this.#extrinsicDecoder = getExtrinsicDecoder(runtimeContext.metadataRaw)
    this.#callCodec = runtimeContext.dynamicBuilder.buildDefinition(lookup.metadata.extrinsic.call)
  }

  hasPallet(name: string) {
    return this.#metadata.pallets.findIndex((p) => p.name === name) > -1
  }

  getTypeIdByPath(path: string | string[]): number | undefined {
    const target = Array.isArray(path) ? path.join('.') : path
    return this.#metadata.lookup.find((ty) => ty.path.join('.').toLowerCase() === target.toLowerCase())?.id
  }

  decodeExtrinsic(hextBytes: string): Extrinsic {
    const xt: {
      callData: Binary
      signed: boolean
      address?: any
      signature?: any
    } = this.#extrinsicDecoder(hextBytes)
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
    return this.#builder.buildStorage(module, method) as StorageCodec<T>
  }

  typeCodec<T = any>(path: string | string[] | number): Codec<T> {
    let id
    if (typeof path === 'number') {
      id = path
    } else {
      id = this.getTypeIdByPath(path)

      if (id === undefined) {
        throw new Error(`type not found: ${path}`)
      }
    }

    return this.#builder.buildDefinition(id) as Codec<T>
  }

  getConstant(palletName: string, name: string) {
    const pallet = this.#metadata.pallets.find((p) => p.name === palletName)
    const constant = pallet?.constants.find((c) => c.name === name)

    return constant === undefined
      ? undefined
      : this.#builder.buildConstant(palletName, name).dec(constant.value)
  }
}

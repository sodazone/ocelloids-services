import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { RuntimeContext, SystemEvent } from '@polkadot-api/observable-client'
import { Decoder, V14, V15, metadata as metadataCodec } from '@polkadot-api/substrate-bindings'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { Binary, Codec } from 'polkadot-api'

import { Extrinsic, StorageCodec } from '../types.js'
import { ApiContext } from './types.js'

export function createRuntimeApiContext(metadataRaw: Uint8Array) {
  const metadata = metadataCodec.dec(metadataRaw).metadata.value as V14 | V15
  const lookup = getLookupFn(metadata)
  const dynamicBuilder = getDynamicBuilder(lookup)
  const events = dynamicBuilder.buildStorage('System', 'Events')

  return new RuntimeApiContext({
    metadataRaw,
    lookup,
    dynamicBuilder,
    events: {
      key: events.enc(),
      dec: events.dec as Decoder<any>,
    },
  } as RuntimeContext)
}

export class RuntimeApiContext implements ApiContext {
  readonly #extrinsicDecoder: ReturnType<typeof getExtrinsicDecoder>
  readonly #ctx: RuntimeContext

  get #metadata() {
    return this.#ctx.lookup.metadata
  }

  get #builder() {
    return this.#ctx.dynamicBuilder
  }

  get events() {
    return this.#ctx.events
  }

  constructor(runtimeContext: RuntimeContext) {
    this.#ctx = runtimeContext
    this.#extrinsicDecoder = getExtrinsicDecoder(runtimeContext.metadataRaw)
  }

  hasPallet(name: string) {
    return this.#metadata.pallets.findIndex((p) => p.name === name) > -1
  }

  getTypeIdByPath(path: string | string[]): number | undefined {
    const target = Array.isArray(path) ? path.join('.') : path
    return this.#metadata.lookup.find((ty) => ty.path.join('.').toLowerCase() === target.toLowerCase())?.id
  }

  decodeExtrinsic(hextBytes: string | Uint8Array): Extrinsic {
    const xt: {
      callData: Binary
      signed: boolean
      address?: any
      signature?: any
    } = this.#extrinsicDecoder(hextBytes)

    const call = this.#builder.buildDefinition(this.#ctx.lookup.call!).dec(xt.callData.asBytes())

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

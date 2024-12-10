import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { RuntimeContext } from '@polkadot-api/observable-client'
import { Decoder, V14, V15, metadata as metadataCodec } from '@polkadot-api/substrate-bindings'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { Binary, Codec } from 'polkadot-api'

import { Extrinsic, Hashers, StorageCodec, SubstrateApiContext } from './types.js'

export function createRuntimeApiContext(metadataRaw: Uint8Array, chainId?: string) {
  let metadata
  try {
    metadata = metadataCodec.dec(metadataRaw).metadata.value as V14 | V15
  } catch (error) {
    throw new Error(`[${chainId}] Failed to decode metadata`, { cause: error })
  }
  const lookup = getLookupFn(metadata)
  const dynamicBuilder = getDynamicBuilder(lookup)
  const events = dynamicBuilder.buildStorage('System', 'Events')

  return new RuntimeApiContext(
    {
      metadataRaw,
      lookup,
      dynamicBuilder,
      events: {
        key: events.enc(),
        dec: events.dec as Decoder<any>,
      },
    } as RuntimeContext,
    chainId,
  )
}

export class RuntimeApiContext implements SubstrateApiContext {
  readonly chainId?: string
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

  constructor(runtimeContext: RuntimeContext, chainId?: string) {
    this.chainId = chainId
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
    try {
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
    } catch (error) {
      throw new Error(`[${this.chainId}] Failed to decode extrinsic.`, { cause: error })
    }
  }

  storageCodec<T = any>(module: string, method: string) {
    try {
      return this.#builder.buildStorage(module, method) as StorageCodec<T>
    } catch (error) {
      throw new Error(`[${this.chainId}] Failed to build storage codec for ${module}.${method}.`, {
        cause: error,
      })
    }
  }

  getHashers(module: string, method: string): Hashers | null {
    const pallet = this.#metadata.pallets.find((p) => p.name === module)

    if (!pallet) {
      throw new Error(`Pallet not found: ${module}`)
    }

    const storageEntry = pallet.storage!.items.find((s) => s.name === method)!

    if (storageEntry.type.tag === 'plain') {
      // no hashers
      return null
    } else {
      const { hashers } = storageEntry.type.value
      return hashers
    }
  }

  typeCodec<T = any>(path: string | string[] | number): Codec<T> {
    let id: number | undefined

    if (typeof path === 'number') {
      id = path
    } else {
      id = this.getTypeIdByPath(path)
      if (id === undefined) {
        throw new Error(
          `[${this.chainId}] Type not found for path: ${Array.isArray(path) ? path.join('.') : path}`,
        )
      }
    }

    try {
      return this.#builder.buildDefinition(id) as Codec<T>
    } catch (error) {
      throw new Error(`[${this.chainId}] Failed to build type codec for ID ${id}.`, { cause: error })
    }
  }

  getConstant(palletName: string, name: string) {
    const pallet = this.#metadata.pallets.find((p) => p.name === palletName)

    if (!pallet) {
      throw new Error(`Pallet not found: ${palletName}`)
    }

    const constant = pallet.constants.find((c) => c.name === name)

    if (!constant) {
      throw new Error(`[${this.chainId}] Constant not found: ${name} in pallet ${palletName}`)
    }

    try {
      return this.#builder.buildConstant(palletName, name).dec(constant.value)
    } catch (error) {
      throw new Error(`[${this.chainId}] Failed to decode constant ${name} from pallet ${palletName}.`, {
        cause: error,
      })
    }
  }
}

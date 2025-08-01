import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { RuntimeContext } from '@polkadot-api/observable-client'
import {
  Binary,
  Blake2256,
  Decoder,
  Option,
  Tuple,
  V14,
  V15,
  compact,
  metadata as metadataCodec,
} from '@polkadot-api/substrate-bindings'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { Codec } from 'polkadot-api'
import { fromHex, toHex } from 'polkadot-api/utils'

import { Call, Extrinsic, Hashers, StorageCodec, SubstrateApiContext } from './types.js'

type Metadata = ReturnType<typeof metadataCodec.dec>
const opaqueMeta = Option(Tuple(compact, metadataCodec))

function decodeMetadata(metadataRaw: Uint8Array, chainId?: string) {
  try {
    const metadata = metadataCodec.dec(metadataRaw)
    return {
      metadata,
      metadataRaw,
    }
  } catch (error) {
    throw new Error(`[${chainId}] Failed to decode metadata`, { cause: error })
  }
}

function decodeOpaqueMetadata(metadataRaw: Uint8Array, chainId?: string) {
  try {
    const [, metadata] = opaqueMeta.dec(metadataRaw)!
    return {
      metadata,
      metadataRaw: metadataCodec.enc(metadata),
    }
  } catch (error) {
    throw new Error(`[${chainId}] Failed to decode metadata`, { cause: error })
  }
}

function createRuntimeApiContext(
  { metadata, metadataRaw }: { metadata: Metadata; metadataRaw: Uint8Array },
  chainId?: string,
) {
  const versionMetadata = metadata.metadata.value as V14 | V15

  const lookup = getLookupFn(versionMetadata)
  const dynamicBuilder = getDynamicBuilder(lookup)
  const events = dynamicBuilder.buildStorage('System', 'Events')

  return new RuntimeApiContext(
    {
      metadataRaw,
      lookup,
      dynamicBuilder,
      events: {
        key: events.keys.enc(),
        dec: events.value.dec as Decoder<any>,
      },
    } as RuntimeContext,
    chainId,
  )
}

export function createContextFromMetadata(metadataRaw: Uint8Array, chainId?: string) {
  return createRuntimeApiContext(decodeMetadata(metadataRaw, chainId))
}

export function createContextFromOpaqueMetadata(metadataRaw: Uint8Array, chainId?: string) {
  return createRuntimeApiContext(decodeOpaqueMetadata(metadataRaw, chainId))
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

  get metadataRaw() {
    return this.#ctx.metadataRaw
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

  decodeCall(callData: string | Uint8Array): Call {
    const call = this.#builder.buildDefinition(this.#ctx.lookup.call!).dec(callData)
    return {
      module: call.type,
      method: call.value.type,
      args: call.value.value,
    }
  }

  decodeExtrinsic(hexBytes: string | Uint8Array): Extrinsic {
    try {
      const xt: {
        callData: Binary
        signed: boolean
        address?: any
        signature?: any
      } = this.#extrinsicDecoder(hexBytes)

      const call = this.decodeCall(xt.callData.asBytes())
      return {
        ...call,
        signed: xt.signed,
        address: xt.address,
        signature: xt.signature,
        hash: toHex(Blake2256(typeof hexBytes === 'string' ? fromHex(hexBytes) : hexBytes)),
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

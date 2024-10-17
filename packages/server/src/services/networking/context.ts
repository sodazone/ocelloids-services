import { MetadataLookup, getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders'
import { V15, decAnyMetadata } from '@polkadot-api/substrate-bindings'
import { Binary, Codec } from 'polkadot-api'

import { HexString } from '@/lib.js'
import { getExtrinsicDecoder } from '@polkadot-api/tx-utils'
import { Extrinsic, StorageCodec } from './types.js'

type Call = { type: string; value: { type: string; value: unknown } }

export class ApiContext {
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
      throw new Error('Only metadata v15 is supported')
    }

    // NOTE: to support v14 we need a call codec that looks by pallet and calls
    // instead of using the convinient extrinsic.call enum.
    // The pallet id and call are the first two bytes of the calldata.

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
    return this.#dynamicBuilder.buildStorage(module, method) as StorageCodec<T>
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

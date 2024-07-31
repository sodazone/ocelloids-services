import { Registry } from '@polkadot/types-codec/types'
import { hexToU8a, u8aConcat, u8aToU8a } from '@polkadot/util'
import { blake2AsU8a, xxhashAsU8a } from '@polkadot/util-crypto'

import { HexString } from '@/lib.js'

const OFFSET_128 = 16 * 2
const OFFSET_64 = 8 * 2

export type Hashing = 'xx-64' | 'blake2-128'

export function fromKeyPrefix(
  registry: Registry,
  prefix: `0x${string}`,
  type: string,
  value: string | unknown,
  hashing: Hashing,
  stripKey: boolean,
) {
  return (prefix +
    Buffer.from(keyConcat(keyValue(registry, type, value, hashing, stripKey).toU8a(), hashing)).toString(
      'hex',
    )) as HexString
}

export function keyValue(
  registry: Registry,
  type: string,
  keyArgs: string | unknown,
  hashing: Hashing,
  stripKey: boolean,
) {
  if (stripKey && typeof keyArgs !== 'string') {
    throw new Error(`incompatible type ${typeof keyArgs} ${keyArgs} to strip key`)
  }
  return registry.createType(
    type,
    stripKey
      ? hexToU8a('0x' + (keyArgs as string).substring(hashing === 'xx-64' ? OFFSET_64 : OFFSET_128))
      : keyArgs,
  )
}

const keyConcat = (data: string | Buffer | Uint8Array, hashing: Hashing) => {
  return hashing === 'xx-64' ? xx64concat(data) : blake2128concat(data)
}

const blake2128concat = (data: string | Buffer | Uint8Array) =>
  u8aConcat(blake2AsU8a(data, 128), u8aToU8a(data))

const xx64concat = (data: string | Buffer | Uint8Array) => u8aConcat(xxhashAsU8a(data, 64), u8aToU8a(data))

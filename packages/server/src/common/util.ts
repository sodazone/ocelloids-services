import { TextEncoder } from 'util'
import { safeDestr } from 'destr'
import { Binary, getSs58AddressInfo } from 'polkadot-api'
import { toHex } from 'polkadot-api/utils'

import { HexString } from '@/lib.js'
import { Event } from '@/services/networking/substrate/types.js'

export function asJSON(o: unknown) {
  return JSON.stringify(o, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v instanceof Binary ? v.asHex() : v,
  )
}

export function asSerializable<T>(o: unknown) {
  return safeDestr<T>(asJSON(o))
}

export function getEventValue(module: string, name: string | string[], events: Event[]) {
  return events.find((e) =>
    e.module === module && Array.isArray(name) ? name.includes(e.name) : e.name === name,
  )?.value
}

export function asPublicKey(accountId: string): HexString {
  if (accountId.startsWith('0x')) {
    return accountId as HexString
  }
  const info = getSs58AddressInfo(accountId)
  if (!info.isValid) {
    throw new Error(`invalid address format ${accountId}`)
  }
  return toHex(info.publicKey) as HexString
}

const textEncoder = new TextEncoder()
export function stringToUa8(v: string) {
  return textEncoder.encode(v)
}

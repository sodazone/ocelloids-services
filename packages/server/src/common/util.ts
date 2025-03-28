import { TextEncoder } from 'util'
import { DuckDBBlobValue } from '@duckdb/node-api'
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

export function toDuckDBHex(input: string): string {
  if (input.startsWith('0x')) {
    const hex = input.slice(2) // Remove the "0x" prefix
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string: must have an even number of characters')
    }
    return `X'01${hex.toUpperCase()}'` // Add flag byte and return in correct format
  }

  // Otherwise, treat it as raw text and encode it to hex
  const hexEncoded = Buffer.from(input, 'utf-8').toString('hex').toUpperCase()

  // Add flag byte to indicate raw text
  return `X'00${hexEncoded}'`
}

export function fromDuckDBBlob(blob: DuckDBBlobValue): string {
  if (blob.bytes[0] === 0x78) {
    const hexString = blob.toString().slice(1)
    // Check if the hex string starts with '01' (indicating hex data with the flag)
    if (hexString.startsWith('01')) {
      // Remove the '01' flag and return the rest of the data as a hex string
      return `0x${hexString.slice(2)}` // Example: 0x01010203 -> 0x01010203
    }

    // Check if the hex string starts with '00' (indicating raw text data with the flag)
    if (hexString.startsWith('00')) {
      // Remove the '00' flag and decode the rest as raw text (UTF-8)
      const rawText = Buffer.from(hexString.slice(2), 'hex').toString('utf-8')
      return rawText // Example: "Hello" as raw text
    }

    throw new Error('Invalid flag byte or format')
  } else {
    throw new Error('Invalid varchar encoding')
  }
}

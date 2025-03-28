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

/**
 * Encodes an input string into a format suitable for storing in a DuckDB BLOB field.
 *
 * This function encodes an input string into a hexadecimal representation, adding a flag byte
 * to indicate whether the input is a hex string or raw text. The flag byte distinguishes between
 * two types of encoding:
 * - `0x01` for hex-encoded data (including addresses with the `0x` prefix).
 * - `0x00` for raw text, which is first converted to a hex string.
 *
 * @param {string} input - The input string to be encoded.
 * @returns {string} - A formatted string for insertion into a DuckDB BLOB field (e.g., `X'01...'` or `X'00...'`).
 *
 * @throws {Error} - If the input is a hex string that doesn't have an even number of characters.
 */
export function toDuckDBHex(input: string): string {
  if (input.startsWith('0x')) {
    const hex = input.slice(2)
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string: must have an even number of characters')
    }
    return `X'01${hex.toUpperCase()}'`
  }

  const hexEncoded = Buffer.from(input, 'utf-8').toString('hex').toUpperCase()
  return `X'00${hexEncoded}'`
}

/**
 * Decodes a BLOB value retrieved from DuckDB into a readable string.
 *
 * This function decodes the BLOB data that was encoded using the `toDuckDBHex` function.
 * The function distinguishes between two types of data:
 * - Hex-encoded data (indicated by the flag byte `0x01`).
 * - Raw text data (indicated by the flag byte `0x00`).
 *
 * @param {DuckDBBlobValue} blob - The BLOB value to decode.
 * @returns {string} - The decoded string, which could either be a hex string or raw text.
 *
 * @throws {Error} - If the BLOB format is invalid or the flag byte is incorrect.
 */
export function fromDuckDBBlob(blob: DuckDBBlobValue): string {
  if (blob.bytes[0] === 0x78) {
    const hexString = blob.toString().slice(1)
    if (hexString.startsWith('01')) {
      return `0x${hexString.slice(2)}`
    }

    if (hexString.startsWith('00')) {
      const rawText = Buffer.from(hexString.slice(2), 'hex').toString('utf-8')
      return rawText
    }

    throw new Error('Invalid flag byte or format')
  } else {
    throw new Error('Invalid varchar encoding')
  }
}

import { HexString } from '@/services/subscriptions/types.js'

export function toSystemAccountKey(value: string): HexString {
  const bytes = new TextEncoder().encode(value)

  if (bytes.length > 32) {
    throw new Error('Address input exceeds 32 bytes')
  }

  const padded = new Uint8Array(32)
  padded.set(bytes)

  const hex = Array.from(padded)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `0x${hex}` as HexString
}

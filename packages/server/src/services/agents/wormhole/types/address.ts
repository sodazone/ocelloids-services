import bs58 from 'bs58'

/**
 * Convert an address to a lowercase hex string.
 *
 * - If it starts with 0x, normalize hex (lowercase, prefixed with 0x)
 * - Else treat as base58 (Solana), must be 32 bytes
 */
export function addressToHex(addr: string): string {
  if (addr.length < 2) {
    return addr
  }

  if (addr.startsWith('0x')) {
    return '0x' + addr.slice(2).toLowerCase()
  }

  // Assume Base58
  const buf = Buffer.from(bs58.decode(addr))
  if (buf.length !== 32) {
    throw new Error(`Invalid base58 address length: ${addr}`)
  }

  return '0x' + buf.toString('hex')
}

import { getSs58AddressInfo } from 'polkadot-api'
import { keccak256 } from 'viem'
import { HexString } from '@/services/subscriptions/types.js'

function leftPadHex(str: HexString, length: number) {
  const hex = str.startsWith('0x') ? str.slice(2) : str
  return '0x' + hex.padStart(length * 2, '0')
}

export function getFrontierAccountStoragesSlot(key: HexString, slot: number) {
  const paddedKey = leftPadHex(key, 32) // pad to 32 bytes
  const paddedSlot = leftPadHex(BigInt(slot).toString(16) as HexString, 32)
  return keccak256((paddedKey + paddedSlot.slice(2)) as HexString) as HexString
}

export function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function isValidSubstratePublicKey(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

export function isValidSs58Address(value: string): boolean {
  try {
    const info = getSs58AddressInfo(value)
    if (info.isValid) {
      return true
    } else {
      return false
    }
  } catch {
    return false
  }
}

import { Binary, getSs58AddressInfo } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'
import { keccak256 } from 'viem'

import { HexString } from '@/lib.js'

import { Balance } from './types.js'

function leftPadHex(str: HexString, length: number) {
  const hex = str.startsWith('0x') ? str.slice(2) : str
  return '0x' + hex.padStart(length * 2, '0')
}

export function calculateFreeBalance(data: Balance): bigint {
  const { free, frozen } = data

  if (free < frozen) {
    return 0n
  }

  return free - frozen
}

export function getFrontierAccountStoragesSlot(key: HexString, slot: number) {
  const paddedKey = leftPadHex(key, 32) // pad to 32 bytes
  const paddedSlot = leftPadHex(BigInt(slot).toString(16) as HexString, 32)
  return keccak256((paddedKey + paddedSlot.slice(2)) as HexString) as HexString
}

export function toBinary(str: HexString) {
  return new Binary(fromHex(str))
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

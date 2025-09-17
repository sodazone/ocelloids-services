import { Balance } from './types.js'

export function calculateFreeBalance(data: Balance): bigint {
  const { free, frozen } = data

  if (free < frozen) {
    return 0n
  }

  return free - frozen
}

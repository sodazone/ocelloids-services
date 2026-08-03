import { Twox256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'
import { ulid } from 'ulidx'
import { stringToUa8 } from '@/common/util.js'

/**
 * Generate a new trip_id (ULID)
 */
export function generateTripId(identifiers?: { chainId: string; values: string[] }): string {
  if (identifiers) {
    return toHex(Twox256(stringToUa8(`${identifiers.chainId}${identifiers.values.join()}`)))
  }

  return ulid()
}

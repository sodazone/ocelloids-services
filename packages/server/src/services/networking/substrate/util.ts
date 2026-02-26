import { Binary } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'

export function serializeStorageKeyArg(obj: any): any {
  if (obj == null) {
    return obj
  }

  if (typeof obj === 'string' && obj.startsWith('0x')) {
    return new Binary(fromHex(obj))
  }

  if (typeof obj === 'string') {
    try {
      return BigInt(obj)
    } catch (_error) {
      //
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeStorageKeyArg)
  }

  if (typeof obj === 'object') {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = serializeStorageKeyArg(value)
    }
    return newObj
  }

  return obj
}

import { AssetId } from '../../steward/types.js'

export function toMelbourne(o: unknown, s = ':'): string {
  if (o == null) {
    return ''
  }

  if (typeof o === 'object') {
    return Object.entries(o)
      .flatMap(([k, v]) => {
        if (k === 'type') {
          return v
        }
        if (k === 'value') {
          return v == null ? null : toMelbourne(v, s)
        }
        return `${k}${s}${toMelbourne(v, s)}`
      })
      .filter(Boolean)
      .join(s)
  }

  return o.toString()
}

export function normalizeAssetId(id: AssetId): string {
  if (typeof id === 'string') {
    return id
  }
  if (typeof id === 'object') {
    return toMelbourne(id)
  }
  return id ? (id as any).toString() : ''
}

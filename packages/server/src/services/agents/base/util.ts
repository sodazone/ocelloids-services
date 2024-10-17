import { safeDestr } from 'destr'
import { Binary } from 'polkadot-api'

import { Event } from '@/services/networking/types.js'

export function asJSON(o: unknown) {
  return JSON.stringify(o, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v instanceof Binary ? v.asHex() : v,
  )
}
export function asSerializable(o: unknown) {
  return typeof o === 'string' ? o : safeDestr<any>(asJSON(o))
}
export function getEventValue(module: string, name: string | string[], events: Event[]) {
  return events.find((e) =>
    e.module === module && Array.isArray(name) ? name.includes(e.name) : e.name === name,
  )?.value
}

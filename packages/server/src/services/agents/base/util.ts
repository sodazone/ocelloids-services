import { Binary } from 'polkadot-api'

export const asJSON = (o: unknown) =>
  JSON.stringify(o, (_, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Binary ? v.asHex() : v))
export const asSerializable = (o: unknown) => (typeof o === 'string' ? o : JSON.parse(asJSON(o)))

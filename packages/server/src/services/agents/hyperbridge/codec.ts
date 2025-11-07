import { Bytes, Enum, Struct } from 'scale-ts'

export const HyperbridgeSignature = Enum({
  Evm: Struct({
    address: Bytes(),
    signature: Bytes(),
  }),
  Sr25519: Struct({
    publicKey: Bytes(),
    signature: Bytes(),
  }),
  Ed25519: Struct({
    publicKey: Bytes(),
    signature: Bytes(),
  }),
})

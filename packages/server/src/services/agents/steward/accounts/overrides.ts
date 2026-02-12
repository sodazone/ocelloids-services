import { SubstrateAccountUpdate } from "./types.js";

export const hydrationOverrides: SubstrateAccountUpdate[] = [
  {
    publicKey: '0x45544800000000000000000000000000000000000000090a0000000000000000',
    evm: [{
      address: '0x000000000000000000000000000000000000090a',
      chainId: 'urn:ocn:polkadot:2034'
    }],
    tags: [{
      chainId: 'urn:ocn:polkadot:2034',
      tag: 'protocol:flash-loan-receiver'
    }]
  }
]

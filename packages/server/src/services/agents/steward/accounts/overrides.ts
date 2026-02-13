import { toHex } from 'polkadot-api/utils'
import { padAccountKey20 } from '@/common/address.js'
import { HexString } from '@/services/subscriptions/types.js'
import { SubstrateAccountUpdate } from './types.js'

export const hydrationOverrides: SubstrateAccountUpdate[] = [
  {
    publicKey: '0x45544800000000000000000000000000000000000000090a0000000000000000',
    evm: [
      {
        address: '0x000000000000000000000000000000000000090a',
        chainId: 'urn:ocn:polkadot:2034',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'protocol:flash-loan-receiver',
      },
    ],
  },
]

export const moonbeamOverrides: SubstrateAccountUpdate[] = [
  {
    publicKey: toHex(padAccountKey20('0xd85bf1bf64265f9cf660b25094a5aa33ac337db3')) as HexString,
    evm: [
      {
        address: '0xd85bf1bf64265f9cf660b25094a5aa33ac337db3',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
]

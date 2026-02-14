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
  {
    publicKey: toHex(padAccountKey20('0x112c208b900bcfc9ff8131d0f45769cb6c7c7d8d')) as HexString,
    evm: [
      {
        address: '0x112c208b900bcfc9ff8131d0f45769cb6c7c7d8d',
        chainId: 'urn:ocn:polkadot:2034',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'protocol:pot-rewards-transfer-strategy',
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
  {
    publicKey: toHex(padAccountKey20('0x4485167772aec1ed2e54038800e0f3890a76cbc7')) as HexString,
    evm: [
      {
        address: '0x4485167772aec1ed2e54038800e0f3890a76cbc7',
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
  {
    publicKey: toHex(padAccountKey20('0xbf39aa4e1563114382f020754fac47565e299162')) as HexString,
    evm: [
      {
        address: '0xbf39aa4e1563114382f020754fac47565e299162',
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
  {
    publicKey: toHex(padAccountKey20('0x619229df13f518e4c9943c7dcb783d138be79e16')) as HexString,
    evm: [
      {
        address: '0x619229df13f518e4c9943c7dcb783d138be79e16',
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
  {
    publicKey: toHex(padAccountKey20('0x13c81e874190490d9f19df734409fbdbca938d05')) as HexString,
    evm: [
      {
        address: '0x13c81e874190490d9f19df734409fbdbca938d05',
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
  {
    publicKey: toHex(padAccountKey20('0x67d5e7640ca54418a8f490da8181ea8e01c82c84')) as HexString,
    evm: [
      {
        address: '0x67d5e7640ca54418a8f490da8181ea8e01c82c84',
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
  {
    publicKey: toHex(padAccountKey20('0x5795d947864ac9a233ad6e41d8b7daa71f10d1aa')) as HexString,
    evm: [
      {
        address: '0x5795d947864ac9a233ad6e41d8b7daa71f10d1aa',
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
  {
    publicKey: toHex(padAccountKey20('0x4c7f187e9f39ea0ffcf105985cb0417f1174b0a2')) as HexString,
    evm: [
      {
        address: '0x4c7f187e9f39ea0ffcf105985cb0417f1174b0a2',
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
  {
    publicKey: toHex(padAccountKey20('0x30f36c704a22c97774fbeb9df796bd609ed53e70')) as HexString,
    evm: [
      {
        address: '0x30f36c704a22c97774fbeb9df796bd609ed53e70',
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
  {
    publicKey: toHex(padAccountKey20('0x091e463110febf48d45b4ef7ed4d9af2f938df3c')) as HexString,
    evm: [
      {
        address: '0x091e463110febf48d45b4ef7ed4d9af2f938df3c',
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
  {
    publicKey: toHex(padAccountKey20('0x46c8f3f9354cbb0a3228178d299543533f45337e')) as HexString,
    evm: [
      {
        address: '0x46c8f3f9354cbb0a3228178d299543533f45337e',
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
  {
    publicKey: toHex(padAccountKey20('0x65d42a9d3d62df082233e28ca0e3bbcba11e183a')) as HexString,
    evm: [
      {
        address: '0x65d42a9d3d62df082233e28ca0e3bbcba11e183a',
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
  {
    publicKey: toHex(padAccountKey20('0xd7033854ae6aa60d03020da557f70fa1a53011a1')) as HexString,
    evm: [
      {
        address: '0xd7033854ae6aa60d03020da557f70fa1a53011a1',
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
  {
    publicKey: toHex(padAccountKey20('0xa6ec268ff3140d445587f792ad056906883e29fa')) as HexString,
    evm: [
      {
        address: '0xa6ec268ff3140d445587f792ad056906883e29fa',
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
  {
    publicKey: toHex(padAccountKey20('0xc3d7a5a7846a677257235cdcd57cda8fa1425370')) as HexString,
    evm: [
      {
        address: '0xc3d7a5a7846a677257235cdcd57cda8fa1425370',
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
  {
    publicKey: toHex(padAccountKey20('0xaac5b58833a1e4264b0c1da8c0154779c714583b')) as HexString,
    evm: [
      {
        address: '0xaac5b58833a1e4264b0c1da8c0154779c714583b',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-pool',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xad6cea45f98444a922a2b4fe96b8c90f0862d2f4')) as HexString,
    evm: [
      {
        address: '0xad6cea45f98444a922a2b4fe96b8c90f0862d2f4',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:squid-multicall',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xce16f69375520ab01377ce7b88f5ba8c48f8d666')) as HexString,
    evm: [
      {
        address: '0xce16f69375520ab01377ce7b88f5ba8c48f8d666',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:squid-router',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x2d5d7d31f671f86c782533cc367f14109a082712')) as HexString,
    evm: [
      {
        address: '0x2d5d7d31f671f86c782533cc367f14109a082712',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:axelar-gas-service',
      },
    ],
  },
]

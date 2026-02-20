import { toHex } from 'polkadot-api/utils'
import { padAccountKey20 } from '@/common/address.js'
import { HexString } from '@/services/subscriptions/types.js'
import { SubstrateAccountUpdate } from './types.js'

export const accountOverrides: SubstrateAccountUpdate[] = [
  {
    publicKey: '0xa7208d10c6622f3f7eca1551de8355fde9de577dbb308d38994ace561738a51f',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kraken',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'exchange_name:kraken',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0x502de5798c411799bc2e975aff8a5c542356ab48254d1d96f15acecdca3d7991',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kraken',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'exchange_name:kraken',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x8167e55fee5bd1cab9465961646ea62dd3793bfec70c1983ba0734d7260bc29d', // 13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xa34a249441ffa5f3f9366b6cf44b823825cf5bb5aa4b167302827a61ac9da120',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0xbb381c0e8a555262ef8a290fd468d8a21409ee4c7a54f01c680357d69ef2a676',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x296c8cc292399aaeafad4e8749833db08bdb5ee21ed60de989e51df7d5d13b6f', // 1wKD98HXHf4kr82vZFbWjP54bp3EDbzmkW7nxxZA1H6VgKU
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:gate.io',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x033e762403c2504222426080dd2d33f08448d5779504283fd61bbd4173d574c3', // 15FhX4aeqrb9TKMVqE4J4y3FUBoSkKAmbvhXQb3iN5pFABy
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xdef13599cffaec89ff066f008857330b8c2ff72c92bb85c01db5cfb7082f2979', // 163KHWFRr1xcjkm43Nr7sL4RKXx3nSihQFqWRtWWF7JW2HBX
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xe0e92ca738afe2956313c455dd627652b7028f6c650cd2379f9e832c3ce0ca7e', // 165tzcxR1o2EUkpZVr17DxQsdJwtEkB6HAh69hQubmKGL93f
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x16c1bf15e79d8e619528f4521d655df8e27f0f0ebaa673556950c8ce0cb10a37', // 1WqcGu9P9mi9CrMYx2LYfftki6V6Rr8Zrk5kzGvmwGaQANd
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },

  {
    publicKey: '0x74a60525f80c23421eea370e589831868b110c7cbbacfd3fa4de9d4812eb5a62', // 13dwsdSH99fzyW24M2E42emTjj6jWSj939W4uMaEyeaEpDp4
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x45544800000000000000000000000000000000000000090a0000000000000000',
    evm: [
      {
        address: '0x000000000000000000000000000000000000090a',
        chainId: 'urn:ocn:polkadot:2034',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 2,
        subCategoryCode: 2,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'protocol:pot-rewards-transfer-strategy',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xd85bf1bf64265f9cf660b25094a5aa33ac337db3')) as HexString,
    evm: [
      {
        address: '0xd85bf1bf64265f9cf660b25094a5aa33ac337db3',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
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
    publicKey: toHex(padAccountKey20('0x921b35e54b45b60ee8142fa234baeb2ff5e307e0')) as HexString,
    evm: [
      {
        address: '0x921b35e54b45b60ee8142fa234baeb2ff5e307e0',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
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
    publicKey: toHex(padAccountKey20('0x2232e98829f985c95c6930342b607496cad7a560')) as HexString,
    evm: [
      {
        address: '0x2232e98829f985c95c6930342b607496cad7a560',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
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
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:axelar-gas-service',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x571fc4e209686a0d7e1502ec4c4bcbf1d96a2211')) as HexString,
    evm: [
      {
        address: '0x571fc4e209686a0d7e1502ec4c4bcbf1d96a2211',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:moondrop',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x5c3dc0ab1bd70c5cdc8d0865e023164d4d3fd8ec')) as HexString,
    evm: [
      {
        address: '0x5c3dc0ab1bd70c5cdc8d0865e023164d4d3fd8ec',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:swap-flash-loan',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf4c10263f2a4b1f75b8a5fd5328fb61605321639')) as HexString,
    evm: [
      {
        address: '0xf4c10263f2a4b1f75b8a5fd5328fb61605321639',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-swap-v2-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf3a5454496e26ac57da879bf3285fa85debf0388')) as HexString,
    evm: [
      {
        address: '0xf3a5454496e26ac57da879bf3285fa85debf0388',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-distributor-v2',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x051fcf8986b30860a1341e0031e5622bd18d8a85')) as HexString,
    evm: [
      {
        address: '0x051fcf8986b30860a1341e0031e5622bd18d8a85',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-swap-v2-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xe93685f3bba03016f02bd1828badd6195988d950')) as HexString,
    evm: [
      {
        address: '0xe93685f3bba03016f02bd1828badd6195988d950',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:layer-zero-executor',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x8e00d5e02e65a19337cdba98bba9f84d4186a180')) as HexString,
    evm: [
      {
        address: '0x8e00d5e02e65a19337cdba98bba9f84d4186a180',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:moonwell-comptroller-v1',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x26a2abd79583155ea5d34443b62399879d42748a')) as HexString,
    evm: [
      {
        address: '0x26a2abd79583155ea5d34443b62399879d42748a',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x58be9bb19c25cbc8a1533c1a9cf5c6bef5d1638e')) as HexString,
    evm: [
      {
        address: '0x58be9bb19c25cbc8a1533c1a9cf5c6bef5d1638e',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x444ae1ed8f4674428178554b56519af52f654337')) as HexString,
    evm: [
      {
        address: '0x444ae1ed8f4674428178554b56519af52f654337',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x7d393bc51b2fc7015c2c9c781feb288054015b7e')) as HexString,
    evm: [
      {
        address: '0x7d393bc51b2fc7015c2c9c781feb288054015b7e',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:beamswap-pair',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf977814e90da44bfa03b6295a0616a897441acec')) as HexString,
    evm: [
      {
        address: '0xf977814e90da44bfa03b6295a0616a897441acec',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf3918988eb3ce66527e2a1a4d42c303915ce28ce')) as HexString,
    evm: [
      {
        address: '0xf3918988eb3ce66527e2a1a4d42c303915ce28ce',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:binance.com',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x76ec5a0d3632b2133d9f1980903305b62678fbd3')) as HexString,
    evm: [
      {
        address: '0x76ec5a0d3632b2133d9f1980903305b62678fbd3',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:btcturk',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf89d7b9c864f589bbf53a82105107622b35eaa40')) as HexString,
    evm: [
      {
        address: '0xf89d7b9c864f589bbf53a82105107622b35eaa40',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bybit',
      },
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x0d0707963952f2fba59dd06f2b425ace40b492fe')) as HexString,
    evm: [
      {
        address: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:gate.io',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xab782bc7d4a2b306825de5a7730034f8f63ee1bc')) as HexString,
    evm: [
      {
        address: '0xab782bc7d4a2b306825de5a7730034f8f63ee1bc',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitvavo',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x377b8ce04761754e8ac153b47805a9cf6b190873')) as HexString,
    evm: [
      {
        address: '0x377b8ce04761754e8ac153b47805a9cf6b190873',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:upbit',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x5bdf85216ec1e38d6458c870992a69e38e03f7ef')) as HexString,
    evm: [
      {
        address: '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitget',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1')) as HexString,
    evm: [
      {
        address: '0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:coinspot',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0x0529ea5885702715e83923c59746ae8734c553b7')) as HexString,
    evm: [
      {
        address: '0x0529ea5885702715e83923c59746ae8734c553b7',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitpanda',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xf0bc8fddb1f358cef470d63f96ae65b1d7914953')) as HexString,
    evm: [
      {
        address: '0xf0bc8fddb1f358cef470d63f96ae65b1d7914953',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:korbit',
      },
    ],
  },
  {
    publicKey: toHex(padAccountKey20('0xff4606bd3884554cdbdabd9b6e25e2fad4f6fc54')) as HexString,
    evm: [
      {
        address: '0xff4606bd3884554cdbdabd9b6e25e2fad4f6fc54',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:swissborg',
      },
    ],
  },
]

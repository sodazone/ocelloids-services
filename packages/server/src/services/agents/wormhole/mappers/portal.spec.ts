import { runWormholeMapperTests, TestCase } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode sUSDS transfer (moonbeam → ethereum)',
    file: 'moonbeam-ethereum_susds.json',
    expected: {
      type: 'transfer',
      from: '0xa9cf61ba352462308a9cea7e0717e3bc7a161835',
      to: '0x9117900a3794ad6d167dd97853f82a1aa07f9bbc',
      assets: [
        {
          asset: 'urn:ocn:ethereum:1|0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
          amount: '18704753340120000000000',
          decimals: 18,
          usd: 19995.38132058,
          fmtAmount: 18704.753340119998,
        },
      ],
    },
  },
  {
    name: 'decode AVAX transfer (moonbeam → avalanche)',
    file: 'moonbeam-avalanche_avax.json',
    expected: {
      type: 'transfer',
      from: '0xd493066498ace409059fda4c1bcd2e73d8cffe01',
      to: '0x8849f05675e034b54506cab84450c8c82694a786',
      assets: [
        {
          asset: 'urn:ocn:ethereum:43114|0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
          amount: '19980000000000000',
          decimals: 18,
          usd: 0.5682312,
          fmtAmount: 0.01998,
        },
      ],
    },
  },
  {
    name: 'decode SOL transfer (moonbeam → solana)',
    file: 'moonbeam-sol_sol.json',
    expected: {
      type: 'transfer',
      from: '0xe06be1798ea5862fa141a717ab90c7c589a92af9',
      to: '0x22e929ae84b3bd96679c12c4d3b329bfb8d3e4b9846927e1ca339220a6ab600c',
      assets: [
        {
          asset: 'urn:ocn:solana:101|so11111111111111111111111111111111111111112',
          amount: '69139731420',
          decimals: 9,
          usd: 14536.62853105,
          fmtAmount: 69.13973142,
        },
      ],
    },
  },
  {
    name: 'decode SUI transfer (moonbeam → sui)',
    file: 'moonbeam-sui_sui.json',
    expected: {
      type: 'transfer',
      from: '0xe06be1798ea5862fa141a717ab90c7c589a92af9',
      to: '0x55e0970e507f945ae4bf0fcc9bbc7800dd37062885eed5b3d545594c49e95f94',
      assets: [
        {
          asset: 'urn:ocn:sui:0x35834a8a|0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3',
          amount: '2001725111540',
          decimals: 9,
          usd: 6805.86537923,
          fmtAmount: 2001.72511154,
        },
      ],
    },
  },
  {
    name: 'decode WETH transfer (ethereum → moonbeam)',
    file: 'ethereum-moonbeam_weth.json',
    expected: {
      type: 'transfer',
      from: '0xb2f33c5718cc68a106f9d2a2ab3a11e70b5c70cc',
      to: '0xf6b9616c63fa48d07d82c93ce02b5d9111c51a3d',
      assets: [
        {
          asset: 'urn:ocn:ethereum:1|0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          amount: '499500000000000000',
          decimals: 18,
          fmtAmount: 0.4995,
        },
      ],
    },
  },
  {
    name: 'decode USDT transfer (moonbeam → ethereum)',
    file: 'moonbeam-ethereum_usdt.json',
    expected: {
      type: 'transfer',
      from: '0x12665ff461d5c63da2d17fd6415a230332832d02',
      to: '0xb32707a838067eba272861355d211f8067a47823',
      assets: [
        {
          asset: 'urn:ocn:ethereum:1|0xdac17f958d2ee523a2206206994597c13d831ec7',
          amount: '537520065',
          decimals: 6,
          usd: 537.520065,
        },
      ],
    },
  },
  {
    name: 'decode PRIME transfer (solana → hydration)',
    file: 'solana-hydration_prime.json',
    expected: {
      type: 'transfer',
      from: '0x50cb37f312b151495ff9219467e419690ced45988f75ae478be53b4dfc6e3ba5',
      to: '0x26f5c2370e563e9f4dda435f03a63d7c109d8d04',
      assets: [
        {
          asset: 'urn:ocn:solana:101|3b8x44flf9ooxaum3hhsgjpmvs6rzz3ppogngahc3uu7',
          symbol: 'PRIME',
          amount: '100000',
          decimals: 6,
          usd: 0.1015,
        },
      ],
    },
  },
]

runWormholeMapperTests(cases, 'wormhole portal mapper')

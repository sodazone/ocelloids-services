import { TestCase, runWormholeMapperTests } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode SOL transfer (moonbeam → solana)',
    file: 'moonbeam-sol_sol.json',
    expected: {
      type: 'transfer',
      from: '0xe06be1798ea5862fa141a717ab90c7c589a92af9',
      to: '0x22e929ae84b3bd96679c12c4d3b329bfb8d3e4b9846927e1ca339220a6ab600c',
      assets: [
        {
          asset: 'urn:ocn:solana:1|native',
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
          asset: 'urn:ocn:sui:1|native',
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
]

runWormholeMapperTests(cases, 'wormhole portal mapper')

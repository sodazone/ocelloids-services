import { runWormholeMapperTests, TestCase } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode NTT Hydration -> Ethereum DAI transfer',
    file: 'ntt-hydration-ethereum_dai.json',
    expected: {
      status: 'waiting',
      type: 'transfer',
      from: '0x204347eb81e9c82ea9c1f0feced1f1c060278383',
      to: '0x23812ff0cddd7157c4760e3bb2d39f5f323a7d3c',
      assets: [
        {
          asset: 'urn:ocn:polkadot:2034|0x0000000000000000000000000000000100000012',
          symbol: '???',
          amount: '10000000',
          decimals: 8,
        },
      ],
    },
  },
  {
    name: 'decode NTT Ethereum -> Hydration DAI transfer',
    file: 'ntt-ethereum-hydration_dai.json',
    expected: {
      status: 'waiting',
      type: 'transfer',
      from: '0x553f022201fa7c88e6cc10d1c688b157d6fa7775',
      to: '0x553f022201fa7c88e6cc10d1c688b157d6fa7775',
      assets: [
        {
          asset: 'urn:ocn:ethereum:1|0x6b175474e89094c44da98b954eedeac495271d0f',
          symbol: 'DAI',
          amount: '1000000000000000000',
          decimals: 18,
        },
      ],
    },
  },
]

runWormholeMapperTests(cases, 'wormhole NTT mapper')

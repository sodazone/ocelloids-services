import { runWormholeMapperTests, TestCase } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode NTT Hydration -> Avalanche NTTUSD transfer',
    file: 'ntt-hydration-avax_nttusd.json',
    expected: {
      status: 'received',
      type: 'transfer',
      from: '0xd3dda7c8608ea251c42c6e0a2a686adc5e9c0c03',
      to: '0xb310408cc8951ddaa38297c872cdd525acbb5fbf',
      assets: [
        {
          asset: 'urn:ocn:polkadot:2034|0x32d20aa7fb151ac1b2c1774d87cbe558f7cbb75e',
          symbol: '???',
          amount: '9990000',
          decimals: 6,
        },
      ],
    },
  },
  {
    name: 'decode NTT Avalanche -> Hydration NTTUSD transfer',
    file: 'ntt-avax-hydration_nttusd.json',
    expected: {
      status: 'waiting',
      type: 'transfer',
      from: '0xb310408cc8951ddaa38297c872cdd525acbb5fbf',
      to: '0xb310408cc8951ddaa38297c872cdd525acbb5fbf',
      assets: [
        {
          asset: 'urn:ocn:ethereum:43114|0xca2a35ba3eed9bc5f7e56bf833526d5cf5eeb475',
          symbol: '???',
          amount: '99900000',
          decimals: 6,
        },
      ],
    },
  },
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
          asset: 'urn:ocn:polkadot:2034|18',
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
      tripId: '0x4ae440693834eae4f4bb48e37637250fbf16b934f147cdcd228c578db5889b24',
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

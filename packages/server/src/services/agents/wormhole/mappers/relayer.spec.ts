import { TestCase, runWormholeMapperTests } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode WELL transfer (moonbeam → base)',
    file: 'moonbeam-base_well.json',
    expected: {
      type: 'transfer',
      from: '0xf97b954d39d8d9a2ee1b449802e8f19cb7230227',
      to: '0xf97b954d39d8d9a2ee1b449802e8f19cb7230227',
      assets: [
        {
          asset: 'urn:ocn:ethereum:8453|0xa88594d404727625a9437c3f886c7643872296ae',
          amount: '10443992272616221569756',
          decimals: 18,
          symbol: 'WELL',
        },
      ],
    },
  },
]

runWormholeMapperTests(cases, 'wormhole custom relayer mapper')

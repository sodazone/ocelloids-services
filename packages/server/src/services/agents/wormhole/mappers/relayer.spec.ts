import { runWormholeMapperTests, TestCase } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode moonwell multichain governor (moonbeam - not relayer)',
    file: 'moonbeam_feedc.json',
    expected: {
      status: 'received',
      type: 'transact',
      from: '0x39801747857f384de011feb2d3a57a38ba925ea4',
      to: '',
      assets: [],
    },
  },
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
  {
    name: 'decode ??? transfer (polygon → moonbeam)',
    file: 'polygon-moonbeam_280131.json',
    expected: {
      type: 'transact',
      from: '0x990ef5d2adca4a2ccf1811f54e4b5506977504cc',
      to: '0x27428dd2d3dd32a4d7f7c497eaaa23130d894911',
      assets: [],
    },
  },
]

runWormholeMapperTests(cases, 'wormhole custom relayer mapper')

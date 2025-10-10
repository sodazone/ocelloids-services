import { TestCase, runWormholeMapperTests } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode WELL transfer (moonbeam → base)',
    file: 'moonbeam-base_feedc.json',
    expected: {
      type: 'transfer',
      from: '0x39801747857f384de011feb2d3a57a38ba925ea4',
      to: '0x8b621804a7637b781e2bbd58e256a591f2df7d51',
      assets: [
        {
          asset: 'urn:ocn:ethereum:8453|0xa88594d404727625a9437c3f886c7643872296ae',
          amount: '11545806346022338000000000',
          decimals: 18,
          symbol: 'WELL',
        },
      ],
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

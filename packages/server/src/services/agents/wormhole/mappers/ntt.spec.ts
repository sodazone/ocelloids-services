import { runWormholeMapperTests, TestCase } from '@/testing/apis/wormhole/wormhole-test.js'

const cases: TestCase[] = [
  {
    name: 'decode NTT transfer (test)',
    file: 'ntt-sample.json',
    expected: {
      status: 'received',
      type: 'transfer',
      from: '0x7f72d8e4d53a9acc52e40c01d504c9ed7099b512',
      to: '0x7f72d8e4d53a9acc52e40c01d504c9ed7099b512',
      assets: [{
        asset: 'urn:ocn:ethereum:1|0xd166337499e176bbc38a1fbd113ab144e5bd2df7',
        symbol: '???',
        amount: '370006138853',
        decimals: 8,
        usd: 3297.04700202,
      }],
    },
  },
]

runWormholeMapperTests(cases, 'wormhole NTT mapper')

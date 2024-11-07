import { astarBlocks, expectedTxs, moonbeamBlocks, stellaFeedsAbi } from '@/testing/blocks.js'

import { Block } from '@/services/networking/types.js'

import {
  FrontierExtrinsic,
  decodeCallData,
  getFromAddress,
  getTxHash,
  isFrontierExtrinsic,
} from './decoder.js'

async function expectTxs(blocks: Block[], expected: string[][]) {
  for (const block of blocks) {
    for (const [i, xt] of block.extrinsics.filter(isFrontierExtrinsic).entries()) {
      const tx = xt.args as FrontierExtrinsic
      const from = await getFromAddress(tx)
      const hash = getTxHash(tx)
      expect(from).toBe(expected[i][0])
      expect(hash).toBe(expected[i][1])
    }
  }
}

describe('connector', () => {
  it('decode astar frontier extrinsics', async () => {
    await expectTxs(astarBlocks(), expectedTxs.astar)
  })
  it('decode moonbeam frontier extrinsics', async () => {
    await expectTxs(moonbeamBlocks(), expectedTxs.moonbeam)
  })
  it('decode call data', () => {
    const abi = stellaFeedsAbi()
    for (const block of moonbeamBlocks()) {
      const xt = block.extrinsics.filter(isFrontierExtrinsic)[0]
      const decoded = decodeCallData((xt.args as FrontierExtrinsic).transaction.value.input, abi)
      expect(decoded).toBeDefined()
      expect(decoded?.functionName).toBe('setPricesWithBits')
      expect(decoded?.args).toStrictEqual([
        14604785875833318142852275006850560180394230613076272n,
        1730373270n,
      ])
    }
  })
})

import { astarBlocks, expectedTxs, moonbeamBlocks, stellaFeedsAbi } from '@/testing/blocks.js'

import { Block } from '@/services/networking/types.js'

import {
  FrontierExtrinsic,
  decodeEvmEventLog,
  decodeEvmFunctionData,
  getFromAddress,
  getTxHash,
  isEVMLog,
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
  it.only('decode evm logs', () => {
    const abi = stellaFeedsAbi()
    for (const block of moonbeamBlocks()) {
      const ev = block.events.filter(isEVMLog)[0]
      const { _address, topics, data } = ev.event.value.log
      const decoded = decodeEvmEventLog({
        topics,
        data,
        abi,
      })
      expect(decoded).toBeDefined()
      expect(decoded?.eventName).toBe('PriceData')
      expect((decoded?.args as any).token).toBe('0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D')
    }
  })
  it('decode call data', () => {
    const abi = stellaFeedsAbi()
    for (const block of moonbeamBlocks()) {
      const xt = block.extrinsics.filter(isFrontierExtrinsic)[0].args as FrontierExtrinsic
      const decoded = decodeEvmFunctionData({ data: xt.transaction.value.input, abi })
      expect(decoded).toBeDefined()
      expect(decoded?.functionName).toBe('setPricesWithBits')
      expect(decoded?.args).toStrictEqual([
        14604785875833318142852275006850560180394230613076272n,
        1730373270n,
      ])
    }
  })
})

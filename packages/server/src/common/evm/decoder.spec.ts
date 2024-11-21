import { astarBlocks, expectedTxs, moonbeamAbis, moonbeamBlocks } from '@/testing/blocks.js'

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

describe('evm decoder', () => {
  it('decode astar frontier extrinsics', async () => {
    await expectTxs(astarBlocks(), expectedTxs.astar)
  })
  it('decode moonbeam frontier extrinsics', async () => {
    await expectTxs(moonbeamBlocks().slice(0, 1), expectedTxs.moonbeam)
  })
  it('decode evm logs', () => {
    const abi = moonbeamAbis().prices
    const block = moonbeamBlocks()[0]
    const ev = block.events.filter(({ event }) => isEVMLog(event))[0]
    const { topics, data } = ev.event.value.log
    const decoded = decodeEvmEventLog({
      topics,
      data,
      abi,
    })
    expect(decoded).toBeDefined()
    expect(decoded?.eventName).toBe('PriceData')
    expect((decoded?.args as any).token).toBe('0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D')
  })
  it('decode call data', () => {
    const abi = moonbeamAbis().prices
    const block = moonbeamBlocks()[0]
    const xt = block.extrinsics.filter(isFrontierExtrinsic)[0].args as FrontierExtrinsic
    const decoded = decodeEvmFunctionData({ data: xt.transaction.value.input, abi })
    expect(decoded).toBeDefined()
    expect(decoded?.functionName).toBe('setPricesWithBits')
    expect(decoded?.args).toStrictEqual([14604785875833318142852275006850560180394230613076272n, 1730373270n])
  })
  it('decode EIP2930 transaction without access list', async () => {
    const block = moonbeamBlocks()[3]
    const xt = block.extrinsics.filter(isFrontierExtrinsic)[1].args as FrontierExtrinsic
    expect(await getFromAddress(xt)).toBe('0x771d8910C37cbabCC39ad3aD053d48367E15d8EC')
  })
  it('get address from legacy tx without chain id', async () => {
    expect(
      await getFromAddress({
        transaction: {
          type: 'Legacy',
          value: {
            action: {
              type: 'Call',
              value: '0xba6bd2aace40c9a14c4123717119a80e9fe6738a',
            },
            gas_limit: ['2000000', '0', '0', '0'],
            gas_price: ['125000000000', '0', '0', '0'],
            input:
              '0x143a28e700000000000000000000000000000000000000000000000000000000000007dd000000000000000000000000000000000000000000000000000000000000002700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
            nonce: ['1522', '0', '0', '0'],
            signature: {
              r: '0x4566f66cd88e7a0dedd30e2d9fed1ef5f7e2a7121d8a191f8480341051f71b89',
              s: '0x385ebbc70af29fe4a7f70cef6c9abf8d0687aeb1aa41e729ca3b57ae6945d238',
              v: '27',
            },
            value: ['50000000000000000', '0', '0', '0'],
          },
        },
      }),
    ).toBe('0x95dd265CCC9ef029d2Df1ba982301b68af69bBbB')
  })
})

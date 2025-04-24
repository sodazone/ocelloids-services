import { decodeBlock, encodeBlock } from './codec.js'
import { Block } from './types.js'

describe('codec', () => {
  it('should encode and decode blocks in CBOR', () => {
    const block: Block = {
      events: [
        {
          event: {
            module: 'mod',
            name: 'event1',
            value: { amount: 0 },
          },
          phase: {
            type: 'ApplyExtrinsic',
            value: 1,
          },
          topics: [],
        },
      ],
      extrinsics: [
        {
          hash: '0xABCD',
          method: '1',
          signature: '0xFFFF',
          module: 'mod',
          signed: true,
          address: '',
          args: {
            a: 'a',
          },
        },
      ],
      extrinsicsRoot: '0x0001',
      hash: '0xABCD',
      number: 0,
      parent: '0x0000',
      stateRoot: '0x0000',
      status: 'finalized',
    }

    expect(decodeBlock(encodeBlock(block))).toStrictEqual(block)
  })
})

import { from } from 'rxjs'
import { extractTxWithEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext_nexus } from '@/testing/xcm.js'
import {
  extractSubstrateHandleRequestFromCompressedCall,
  extractSubstrateHandleUnsigned,
} from './handle-request.js'

describe('handle post request operators', () => {
  describe('extractSubstrateHandleRequests', () => {
    it('should extract successful handle requests in Bifrost', async () => {
      const block$ = from(testBlocksFrom('bifrost/9865133.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleUnsigned('urn:ocn:polkadot:2030'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe('urn:ocn:ethereum:1')
            expect(msg.destination).toBe('urn:ocn:polkadot:2030')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.commitment).toBe('0x4ca64542b20547cb33f4ffe56d45244ba2dc244eb3fe9c7183efb25c61b7ff69')
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.relayer).toBe('0x88c0ebf44361da08bbfdf58ea912d428246760b39c4886d263227ce535b9fe30')
            expect(msg.outcome).toBe('Success')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract successful handle timeouts in Bifrost', async () => {
      const block$ = from(testBlocksFrom('bifrost/9866926.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleUnsigned('urn:ocn:polkadot:2030'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe('urn:ocn:polkadot:2030')
            expect(msg.destination).toBe('urn:ocn:ethereum:1')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.commitment).toBe('0x5a62e058b70d03bdc2de1b9ed8a161b9d66f8e1152e9fa1fe35445db1b04d334')
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.outcome).toBe('Success')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract failed handle requests in Bifrost', async () => {
      const block$ = from(testBlocksFrom('bifrost/9858137.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleUnsigned('urn:ocn:polkadot:2030'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe('urn:ocn:ethereum:56')
            expect(msg.destination).toBe('urn:ocn:polkadot:2030')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.relayer).toBe('0x88c0ebf44361da08bbfdf58ea912d428246760b39c4886d263227ce535b9fe30')
            expect(msg.outcome).toBe('Fail')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should skip handle_unsigned extrinsics without requests', async () => {
      const block$ = from(testBlocksFrom('nexus/7681786.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleUnsigned('urn:ocn:polkadot:3367'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })

  describe('extractSubstrateHandleRequestFromCompressedCall', () => {
    it('should extract success compressed handle_unsigned call', async () => {
      const block$ = from(testBlocksFrom('nexus/7685881.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleRequestFromCompressedCall('urn:ocn:polkadot:3367', apiContext_nexus),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBeDefined()
            expect(msg.destination).toBeDefined()
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.relayer).toBe('0x88c0ebf44361da08bbfdf58ea912d428246760b39c4886d263227ce535b9fe30')
            expect(msg.outcome).toBe('Success')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(5)
            resolve()
          },
        })
      })
    })

    it('should extract failed compressed handle_unsigned call', async () => {
      const block$ = from(testBlocksFrom('nexus/7693710.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractSubstrateHandleRequestFromCompressedCall('urn:ocn:polkadot:3367', apiContext_nexus),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBeDefined()
            expect(msg.destination).toBeDefined()
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.relayer).toBeDefined()
            expect(msg.relayer?.length).toBe(66)
            expect(msg.outcome).toBe('Fail')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(11)
            resolve()
          },
        })
      })
    })
  })
})

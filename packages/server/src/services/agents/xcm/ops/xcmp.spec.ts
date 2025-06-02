import { extractEvents } from '@/services/networking/substrate/index.js'
import { apiContext, xcmpSend } from '@/testing/xcm.js'

import { NetworkURN } from '@/lib.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { Binary } from 'polkadot-api'
import { from } from 'rxjs'
import { extractXcmpSend } from './xcmp.js'

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract XCMP sent message', async () => {
      const { origin, blocks, getHrmp } = xcmpSend
      const calls = vi.fn()
      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.sender?.signer.id).toBeDefined()
            calls()
          },
          complete: () => {
            // should be 1 since we don't want dups
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract bridgehub xcmp sent', async () => {
      const origin = 'urn:ocn:local:1002' as NetworkURN
      const blocks = from(testBlocksFrom('bridgehub/5290865.cbor'))
      const getHrmp = () =>
        from([
          [
            {
              recipient: 1000,
              data: Binary.fromHex(
                '0x00052402040100000327d33b511301000002286bee000b010450250907040104020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90013000010433510e9fa0a16040d01020802010907040e010208010100c91f0c130100009e248456000d010208000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc481292cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc48129',
              ),
            },
          ],
        ])

      const calls = vi.fn()
      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.sender?.signer.id).toBeDefined()
          },
          complete: () => {
            // should be 1 since we don't want dups
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })
})

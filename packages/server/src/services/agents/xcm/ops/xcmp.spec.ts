import { extractEvents } from '@/services/networking/substrate/index.js'
import { apiContext, xcmpSend } from '@/testing/xcm.js'

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
  })
})

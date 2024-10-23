import { extractEvents } from '@/common/index.js'
import { apiContext, xcmpReceive, xcmpSend } from '@/testing/xcm.js'

import { extractXcmpReceive, extractXcmpSend } from './xcmp.js'

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
            expect(msg.messageData).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })
    /*
    it('should extract XCMP sent on hops', (done) => {
      const { origin, blocks, getHrmp } = xcmHop

      const calls = vi.fn()

      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.instructions).toBeDefined()
          expect(msg.messageData).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          expect(msg.timestamp).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(2)
          done()
        },
      })
    })
      */
  })

  describe('extractXcmpReceive', () => {
    it('should extract XCMP receive with outcome success', async () => {
      const { successBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractXcmpReceive()(successBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract failed XCMP received message with error', async () => {
      const { failBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractXcmpReceive()(failBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.timestamp).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract assets trapped info on XCMP received message', async () => {
      const { trappedBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractXcmpReceive()(trappedBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.assetsTrapped).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })
})

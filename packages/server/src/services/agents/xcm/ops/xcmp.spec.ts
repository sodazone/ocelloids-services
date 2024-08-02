import { jest } from '@jest/globals'
import { extractEvents } from '@sodazone/ocelloids-sdk'

import { registry, xcmHop, xcmpReceive, xcmpSend } from '@/testing/xcm.js'

import { extractXcmpReceive, extractXcmpSend } from './xcmp.js'

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract XCMP sent message', (done) => {
      const { origin, blocks, getHrmp } = xcmpSend

      const calls = jest.fn()

      const test$ = extractXcmpSend(origin, getHrmp, registry)(blocks.pipe(extractEvents()))

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
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract XCMP sent on hops', (done) => {
      const { origin, blocks, getHrmp } = xcmHop

      const calls = jest.fn()

      const test$ = extractXcmpSend(origin, getHrmp, registry)(blocks.pipe(extractEvents()))

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
  })

  it('should extract XCMP sent message matching by public key', (done) => {
    const { origin, blocks, getHrmp } = xcmpSend

    const calls = jest.fn()

    const test$ = extractXcmpSend(origin, getHrmp, registry)(blocks.pipe(extractEvents()))

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
        expect(calls).toHaveBeenCalledTimes(1)
        done()
      },
    })
  })

  describe('extractXcmpReceive', () => {
    it('should extract XCMP receive with outcome success', (done) => {
      const { successBlocks } = xcmpReceive

      const calls = jest.fn()

      const test$ = extractXcmpReceive()(successBlocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          expect(msg.timestamp).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract failed XCMP received message with error', (done) => {
      const { failBlocks } = xcmpReceive

      const calls = jest.fn()

      const test$ = extractXcmpReceive()(failBlocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Fail')
          expect(msg.error).toBeDefined()
          expect(msg.timestamp).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract assets trapped info on XCMP received message', (done) => {
      const { trappedBlocks } = xcmpReceive

      const calls = jest.fn()

      const test$ = extractXcmpReceive()(trappedBlocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Fail')
          expect(msg.error).toBeDefined()
          expect(msg.assetsTrapped).toBeDefined()
          expect(msg.timestamp).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })
})

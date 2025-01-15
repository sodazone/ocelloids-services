import { extractEvents } from '@/common/index.js'
import { apiContext, umpReceive, umpSend } from '@/testing/xcm.js'

import { extractUmpReceive, extractUmpSend } from './ump.js'

describe('ump operator', () => {
  describe('extractUmpSend', () => {
    it('should extract UMP sent message', async () => {
      const { origin, blocks, getUmp } = umpSend
      const calls = vi.fn()
      const test$ = extractUmpSend(origin, getUmp, apiContext)(blocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
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
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })
  })

  describe('extractUmpReceive', () => {
    it('should extract failed UMP received message', async () => {
      const { successBlocks } = umpReceive
      const calls = vi.fn()
      const test$ = extractUmpReceive()(successBlocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            expect(msg.timestamp).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract UMP receive with outcome fail', async () => {
      const { failBlocks } = umpReceive
      const calls = vi.fn()
      const test$ = extractUmpReceive()(failBlocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.timestamp).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract ump receive with asset trap', async () => {
      const { trappedBlocks } = umpReceive
      const calls = vi.fn()
      const test$ = extractUmpReceive()(trappedBlocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.error).toBeUndefined()
            expect(msg.assetsTrapped).toBeDefined()
            expect(msg.timestamp).toBeDefined()
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

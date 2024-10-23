import { extractEvents } from '@/common/index.js'
import {
  apiContext,
  dmpReceive,
  dmpXcmPalletSentEvent,
  //xcmHop,
  //xcmHopOrigin,
} from '@/testing/xcm.js'
import { extractDmpReceive, extractDmpSendByEvent } from './dmp.js'

describe('dmp operator', () => {
  /*describe('extractDmpSend', () => {
    it('should extract DMP sent for multi-leg messages', async () => {
      const { origin, blocks, getDmp } = xcmHopOrigin
      const calls = vi.fn()
      const test$ = extractDmpSendByEvent(origin, getDmp, apiContext)(blocks.pipe(extractEvents()))

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
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })
    */

  describe('extractDmpSendByEvent', () => {
    it('should extract DMP sent message filtered by event', async () => {
      const { origin, blocks, getDmp } = dmpXcmPalletSentEvent
      const calls = vi.fn()
      const test$ = extractDmpSendByEvent(origin, getDmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageData).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
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

  describe('extractDmpReceive', () => {
    it('should extract DMP received message with outcome success', async () => {
      const { successBlocks } = dmpReceive
      const calls = vi.fn()
      const test$ = extractDmpReceive()(successBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
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

    it('should extract failed DMP received message with error', async () => {
      const { failBlocks } = dmpReceive
      const calls = vi.fn()
      const test$ = extractDmpReceive()(failBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
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

    /*
    it('should extract DMP received for hop message', async () => {
      const { blocks } = xcmHop
      const calls = vi.fn()
      const test$ = extractDmpReceive()(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
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
            resolve()
          },
        })
      })
    })*/
  })
})

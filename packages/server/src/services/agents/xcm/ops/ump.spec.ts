import { jest } from '@jest/globals'
import { extractEvents } from '@sodazone/ocelloids-sdk'

import { registry, umpReceive, umpSend } from '@/testing/xcm.js'

import { extractUmpReceive, extractUmpSend } from './ump.js'

describe('ump operator', () => {
  describe('extractUmpSend', () => {
    it('should extract UMP sent message', (done) => {
      const { origin, blocks, getUmp } = umpSend

      const calls = jest.fn()

      const test$ = extractUmpSend(origin, getUmp, registry)(blocks.pipe(extractEvents()))

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
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })

  describe('extractUmpReceive', () => {
    it('should extract failed UMP received message', (done) => {
      const { successBlocks } = umpReceive

      const calls = jest.fn()

      const test$ = extractUmpReceive('urn:ocn:local:1000')(successBlocks.pipe(extractEvents()))

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
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract UMP receive with outcome fail', (done) => {
      const { failBlocks } = umpReceive

      const calls = jest.fn()

      const test$ = extractUmpReceive('urn:ocn:local:1000')(failBlocks.pipe(extractEvents()))

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
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract ump receive with asset trap', (done) => {
      const { trappedBlocks } = umpReceive

      const calls = jest.fn()

      const test$ = extractUmpReceive('urn:ocn:local:2004')(trappedBlocks.pipe(extractEvents()))

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
          expect(msg.error).toBeNull()
          expect(msg.assetsTrapped).toBeDefined()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(2)
          done()
        },
      })
    })
  })
})

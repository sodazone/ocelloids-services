import { Binary } from 'polkadot-api'
import { from } from 'rxjs'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext, umpReceive, umpSend, umpV5Send } from '@/testing/xcm.js'
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

    it('should extract message ID in XCM v5 sent message', async () => {
      const { origin, blocks, getUmp } = umpV5Send
      const calls = vi.fn()
      const test$ = extractUmpSend(origin, getUmp, apiContext)(blocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.messageId).toBeDefined()
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

    it('should extract UMP sent message with trailing metadata', async () => {
      const blocks = from(testBlocksFrom('kcoretime/4708533.cbor'))
      const getUmp = () => {
        const binaries: Binary[] = [
          Binary.fromHex(
            '0x050c2f000006000102286bee0190184a02b01af2012ce675371a20d0958c9d1d78c4b6bc1a9a8c84d7d4bb80d6699f9b43bb28ffb465',
          ),
          Binary.fromHex('0x'),
          Binary.fromHex(
            '0x019800240801122065b731a298d51b5dbb488f5c9bf4f73886c64658dc90927c9a25bf3e65f5939a',
          ),
        ]
        const hexValues = binaries.map((b) => b.asHex())
        const endIndex = hexValues.indexOf('0x')

        return endIndex === -1 ? from([binaries]) : from([binaries.slice(0, endIndex)])
      }
      const calls = vi.fn()
      const test$ = extractUmpSend('urn:ocn:kusama:1005', getUmp, apiContext)(blocks.pipe(extractEvents()))

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
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('extractUmpReceive', () => {
    it('should extract UMP receive with outcome success', async () => {
      const { successBlocks } = umpReceive
      const calls = vi.fn()
      const test$ = extractUmpReceive()(successBlocks.pipe(extractEvents()))

      new Promise<void>((resolve) => {
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

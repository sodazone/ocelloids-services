import { extractEvents } from '@/services/networking/substrate/index.js'
import { pkBridgeAccepted } from '@/testing/pk-bridge.js'
import { apiContext_bridgehub } from '@/testing/xcm.js'
import { extractBridgeMessageAccepted } from './pk-bridge.js'

describe('bridge operator', () => {
  describe('extractBridgeMessageAccepted', () => {
    it('should extract accepted bridge messages on Bridge Hub', async () => {
      const { origin, blocks, getPkBridge } = pkBridgeAccepted

      const calls = vi.fn()

      const test$ = extractBridgeMessageAccepted(
        origin,
        getPkBridge,
        apiContext_bridgehub,
      )(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
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
})

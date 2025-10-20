import { extractEvents } from '@/services/networking/substrate/index.js'
import { pkBridgeAccepted, pkBridgeReceived } from '@/testing/pk-bridge.js'
import { apiContext_bridgehub } from '@/testing/xcm.js'
import { extractBridgeMessageAccepted, extractBridgeReceive } from './pk-bridge.js'

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
            expect(msg.bridgeKey).toBe('0x2187c09768bea89f950237053705096c000000011806000000000000')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('extractBridgeReceive', () => {
    it('should extract bridge message receive events when message arrives on receving Bridge Hub', async () => {
      const { chainId, blocks } = pkBridgeReceived

      const calls = vi.fn()
      const test$ = extractBridgeReceive(chainId)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.txHash).toBeDefined()
            expect(msg.txPosition).toBeDefined()
            expect(msg.chainId).toBeDefined()
            expect(msg.chainId).toBe(chainId)
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            expect(msg.error).toBeNull()
            expect(msg.bridgeKey).toBe('0x2187c09768bea89f950237053705096c000000011806000000000000')
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

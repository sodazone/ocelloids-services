import { extractTxWithEvents } from '@/common/index.js'
import { NetworkURN } from '@/services/types.js'
import { apiContext, relayHrmpReceive } from '@/testing/xcm.js'
import { messageCriteria } from './criteria.js'
import { extractRelayReceive } from './relay.js'

describe('relay operator', () => {
  describe('extractRelayReceive', () => {
    it('should extract HRMP messages when they arrive on the relay chain', async () => {
      const { blocks, messageControl, origin, destination } = relayHrmpReceive

      const calls = vi.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        apiContext,
      )(blocks.pipe(extractTxWithEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            console.log(msg)
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.recipient).toBe(destination)
            expect(msg.extrinsicPosition).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            expect(msg.error).toBeUndefined()
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

    it('should pass through if messagae control is updated to remove destination', async () => {
      const { blocks, messageControl, origin } = relayHrmpReceive
      const calls = vi.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        apiContext,
      )(blocks.pipe(extractTxWithEvents()))

      // remove destination from criteria
      messageControl.change(messageCriteria(['urn:ocn:local:2000', 'urn:ocn:local:2016']))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (_) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })
})

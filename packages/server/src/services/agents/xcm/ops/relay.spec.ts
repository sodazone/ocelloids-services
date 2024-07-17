import { jest } from '@jest/globals'

import { extractTxWithEvents } from '@sodazone/ocelloids-sdk'
import { registry, relayHrmpReceive } from '@/testing/xcm.js'
import { NetworkURN } from '@/services/types.js'
import { messageCriteria } from './criteria.js'
import { extractRelayReceive } from './relay.js'

describe('relay operator', () => {
  describe('extractRelayReceive', () => {
    it('should extract HRMP messages when they arrive on the relay chain', (done) => {
      const { blocks, messageControl, origin, destination } = relayHrmpReceive

      const calls = jest.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        registry,
      )(blocks.pipe(extractTxWithEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          expect(msg.recipient).toBe(destination)
          expect(msg.extrinsicId).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          expect(msg.error).toBeNull()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(2)
          done()
        },
      })
    })

    it('should pass through if messagae control is updated to remove destination', (done) => {
      const { blocks, messageControl, origin } = relayHrmpReceive

      const calls = jest.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        registry,
      )(blocks.pipe(extractTxWithEvents()))

      // remove destination from criteria
      messageControl.change(messageCriteria(['urn:ocn:local:2000', 'urn:ocn:local:2006']))

      test$.subscribe({
        next: (_) => {
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(0)
          done()
        },
      })
    })
  })
})

import { from } from 'rxjs'
import { extractTxWithEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { extractBasejumpProxy } from './relay.js'

describe('basejump relay operators', () => {
  describe('extractEvmRequest', () => {
    it('should extract Basejump proxy message', async () => {
      const block$ = from(testBlocksFrom('moonbeam/15901334.cbor'))
      const test$ = block$.pipe(
        extractTxWithEvents(),
        extractBasejumpProxy('urn:ocn:polkadot:2004', '0xf5b9334e44f800382cb47fc19669401d694e529b'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.chainId).toBe('urn:ocn:polkadot:2004')
            expect(msg.vaaId).toBe('30/000000000000000000000000f5b9334e44f800382cb47fc19669401d694e529b/133')
            expect(msg.outcome).toBe('Success')
            expect(msg.guardianSet).toBeDefined()
            expect(msg.relayer).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.txHash).toBeDefined()
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

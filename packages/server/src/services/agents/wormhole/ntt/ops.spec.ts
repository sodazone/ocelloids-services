import { from, mergeMap } from 'rxjs'
import { testEvmBlocksFrom } from '@/testing/blocks.js'
import { extractNttTransferRedeemed } from './ops.js'

describe('wormhole ntt operator', () => {
  describe('extractNttTransferRedeemed', () => {
    it('should extract ntt inbound', async () => {
      const chainId = 'urn:ocn:ethereum:222222'

      const block$ = from(testEvmBlocksFrom('hydration_evm/14405953.cbor', true))
      const test$ = block$.pipe(
        mergeMap((blockWithLogs) => {
          return from(blockWithLogs.logs).pipe(
            extractNttTransferRedeemed(chainId, (_blockNumber: bigint | string) =>
              Promise.resolve(Date.now()),
            ),
          )
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.digest).toBeDefined()
            expect(msg.chainId).toBe(chainId)
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })
  })
})

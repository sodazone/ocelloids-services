import { from, mergeMap } from 'rxjs'
import { extractTransactions } from '@/services/networking/near/extract.js'
import { testEvmBlocksFrom, testNearBlocksFrom } from '@/testing/blocks.js'
import { testNearTxStatusFrom } from '@/testing/near.js'
import { extractNearNttTransferRedeemed, extractNttTransferRedeemed } from './ops.js'

describe('wormhole ntt operator', () => {
  describe('extractNttTransferRedeemed', () => {
    it('should extract ntt inbound on Hydration', async () => {
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

    it('should extract ntt inbound on Near', async () => {
      const chainId = 'urn:ocn:near:397'

      const block$ = from(testNearBlocksFrom('near/220645627.json'))
      const test$ = block$.pipe(
        extractTransactions(),
        extractNearNttTransferRedeemed(chainId, (_txHash: string, _senderAccountId: string) =>
          Promise.resolve(testNearTxStatusFrom('ntt-near_220645627.json')),
        ),
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
            expect(msg.digest).toBe('0xedcffbe05e658638f2ca167d240fd74c30cf0c390a798412b43565f0a8208986')
            expect(msg.chainId).toBe(chainId)
            expect(msg.recipient).toBe('div31.near')
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

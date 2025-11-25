import { from, mergeMap, of } from 'rxjs'
import { HexString } from '@/lib.js'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom, testEvmBlocksFrom } from '@/testing/blocks.js'
import { extractEvmRequest, extractSubstrateRequest } from './post-request.js'

describe('requests operators', () => {
  describe('extractSubstrateRequest', () => {
    it('should extract substrate asset teleport post request', async () => {
      const block$ = from(testBlocksFrom('bifrost/9757607.cbor'))
      const mockGetIsmpRequest = (_commitment: HexString) =>
        from([
          {
            source: 'POLKADOT-2030',
            dest: 'EVM-8453',
            nonce: 35051,
            from: '0xa09b1c60e8650245f92518c8a17314878c4043ed' as HexString,
            to: '0xfd413e3afe560182c4471f4d143a96d3e259b6de' as HexString,
            timeoutTimestamp: 0,
            body: '0x000000000000000000000000000000000000000000000000056b9213c1bb6e80002c39e61e26a9f54b13049db72ed462371c4675161ad800538eefbb25e5f5531f0000000000000000000000000000000000000000000000000000000000000000b81d772dc8e081ef5885afdbfae2ac3ef35847e1d24612427688394dfd0c7013000000000000000000000000aed7ae5288db82db2575de216edc443bc8764a07' as HexString,
          },
        ])
      const test$ = block$.pipe(
        extractEvents(),
        extractSubstrateRequest('urn:ocn:polkadot:2030', mockGetIsmpRequest),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe('urn:ocn:polkadot:2030')
            expect(msg.destination).toBe('urn:ocn:ethereum:8453')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
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

    it('should extract substrate oracle update request', async () => {
      const block$ = from(testBlocksFrom('bifrost/9792939.cbor'))
      const mockGetIsmpRequest = (_commitment: HexString) =>
        from([
          {
            source: 'POLKADOT-2030',
            dest: 'EVM-1868',
            nonce: 35801,
            from: '0x6269662d736c7078' as HexString,
            to: '0x0a702f34da7b4514c74d35ff68891d1ee57930ef' as HexString,
            timeoutTimestamp: 1761837624,
            body: '0x0000000000000000000000002cae934a1e84f693fbb78ca5ed3b0a689325944100000000000000000000000000000000000000000050d708111acc59deccfb770000000000000000000000000000000000000000003df5230ccbbf26cadacc37' as HexString,
          },
        ])

      const test$ = block$.pipe(
        extractEvents(),
        extractSubstrateRequest('urn:ocn:polkadot:2030', mockGetIsmpRequest),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe('urn:ocn:polkadot:2030')
            expect(msg.destination).toBe('urn:ocn:ethereum:1868')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
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

  describe('extractEvmRequest', () => {
    it('should extract ethereum asset teleport post request', async () => {
      const chainId = 'urn:ocn:ethereum:1'
      const block$ = from(testEvmBlocksFrom('ethereum/23688872.cbor', true))
      const test$ = block$.pipe(
        mergeMap((blockWithLogs) => {
          const logs = blockWithLogs.logs
          const block = { ...blockWithLogs, logs: undefined }
          return of(block).pipe(
            extractEvmRequest(chainId, vi.fn().mockResolvedValue({ status: 'success', logs })),
          )
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe(chainId)
            expect(msg.destination).toBe('urn:ocn:polkadot:2030')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.commitment).toBe('0xed50a846c6bb0553a802bf86ea15f5d6c5f18a67a0872d44d7b5273d6baf2511')
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
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

    it('should extract polygon intent post request', async () => {
      const chainId = 'urn:ocn:ethereum:137'
      const block$ = from(testEvmBlocksFrom('polygon/78713230.cbor', true))
      const test$ = block$.pipe(
        mergeMap((blockWithLogs) => {
          const logs = blockWithLogs.logs
          const block = { ...blockWithLogs, logs: undefined }
          return of(block).pipe(
            extractEvmRequest(chainId, vi.fn().mockResolvedValue({ status: 'success', logs })),
          )
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe(chainId)
            expect(msg.destination).toBe('urn:ocn:ethereum:56')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.commitment).toBe('0x7fa7a656cd3e361269a6d21f79ca9d007d71bd6442eb027bf28057f68c5225d1')
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.txHash).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract arbitrum intent post request', async () => {
      const chainId = 'urn:ocn:ethereum:42161'
      const block$ = from(testEvmBlocksFrom('arbitrum/403826199.cbor', true))
      const test$ = block$.pipe(
        mergeMap((blockWithLogs) => {
          const logs = blockWithLogs.logs
          const block = { ...blockWithLogs, logs: undefined }
          return of(block).pipe(
            extractEvmRequest(chainId, vi.fn().mockResolvedValue({ status: 'success', logs })),
          )
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.source).toBe(chainId)
            expect(msg.destination).toBe('urn:ocn:ethereum:1')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.commitment).toBe('0x4fc355c0f141f7f73f18e5c1c9db28f0616efe54dd9f0c603ef3ca90e713553b')
            expect(msg.nonce).toBeDefined()
            expect(msg.from).toBeDefined()
            expect(msg.to).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
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

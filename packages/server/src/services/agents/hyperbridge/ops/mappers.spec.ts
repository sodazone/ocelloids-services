import { from } from 'rxjs'
import { HexString } from '@/lib.js'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom, testEvmBlocksFrom } from '@/testing/blocks.js'
import { mapIsmpRequestToJourney } from './mappers.js'
import { extractEvmRequest, extractSubstrateRequest } from './post-request.js'

describe('hyperbridge mappers', () => {
  describe('mapHyperbridgeDispatched', () => {
    it('should map asset teleport request from Bifrost', async () => {
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
        mapIsmpRequestToJourney(),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.origin.chainId).toBe('urn:ocn:polkadot:2030')
            expect(msg.origin.blockHash).toBeDefined()
            expect(msg.origin.blockNumber).toBeDefined()
            expect(msg.origin.txHash).toBeDefined()
            expect(msg.destination.chainId).toBe('urn:ocn:ethereum:8453')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.decoded).toBeDefined()
            expect(msg.decoded).toHaveProperty('action', 'incoming-asset')
            expect(msg.decoded).toHaveProperty('assetId')
            expect(msg.decoded).toHaveProperty('amount')
            expect(msg.decoded).toHaveProperty('from')
            expect(msg.decoded).toHaveProperty('to')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should map bifrost oracle update request', async () => {
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
        mapIsmpRequestToJourney(),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.origin.chainId).toBe('urn:ocn:polkadot:2030')
            expect(msg.origin.blockHash).toBeDefined()
            expect(msg.origin.blockNumber).toBeDefined()
            expect(msg.destination.chainId).toBe('urn:ocn:ethereum:1868')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.nonce).toBeDefined()
            expect(msg.decoded).toBeDefined()
            expect(msg.decoded).toHaveProperty('method')
            expect(msg.decoded).toHaveProperty('args')
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should map asset teleport request from Ethereum', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23738652.cbor'))
      const test$ = block$.pipe(extractEvmRequest('urn:ocn:ethereum:1'), mapIsmpRequestToJourney())
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.origin.chainId).toBe('urn:ocn:ethereum:1')
            expect(msg.origin.blockHash).toBeDefined()
            expect(msg.origin.blockNumber).toBeDefined()
            expect(msg.origin.txHash).toBeDefined()
            expect(msg.destination.chainId).toBe('urn:ocn:polkadot:2030')
            expect(msg.body).toBeDefined()
            expect(msg.commitment).toBeDefined()
            expect(msg.decoded).toBeDefined()
            expect(msg.decoded).toHaveProperty('action', 'incoming-asset')
            expect(msg.decoded).toHaveProperty('assetId')
            expect(msg.decoded).toHaveProperty('amount')
            expect(msg.decoded).toHaveProperty('from')
            expect(msg.decoded).toHaveProperty('to')
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

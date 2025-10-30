import { from } from 'rxjs'
import { HexString } from '@/lib.js'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { extractSubstrateRequest } from './requests.js'

describe('requests operators', () => {
  describe('extractSubstrateRequest', () => {
    it('should extract hyperbridge substrate post request', async () => {
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
      const test$ = block$.pipe(extractEvents(), extractSubstrateRequest(mockGetIsmpRequest))
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            // expect(msg.chainId).toBe('urn:ocn:polkadot:1002')
            // expect(msg.channelId).toBeDefined()
            // expect(msg.messageId).toBeDefined()
            // expect(msg.nonce).toBeDefined()
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

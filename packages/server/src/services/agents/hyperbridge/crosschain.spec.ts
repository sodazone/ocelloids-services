import { toNewJourney } from './crosschain.js'
import { HyperbridgeDecodedPayload } from './types.js'

describe('hyperbridge crosschain mappings', () => {
  describe('toNewJourney', () => {
    it('should convert Bifrost oracle update to new crosschain journey', () => {
      const msg: HyperbridgeDecodedPayload = {
        originProtocol: 'hyperbridge',
        destinationProtocol: 'hyperbridge',
        from: { key: '0x6269662d736c7078', formatted: 'bifrost-slpx' },
        to: {
          key: '0x0a702f34da7b4514c74d35ff68891d1ee57930ef',
          formatted: undefined,
        },
        commitment: '0xd969485f2136381b795f6d16b5eb7769d5a38143f9d9d9ed5b02eadd826ba09f',
        nonce: '35801',
        body: '0x0000000000000000000000002cae934a1e84f693fbb78ca5ed3b0a689325944100000000000000000000000000000000000000000050d708111acc59deccfb770000000000000000000000000000000000000000003df5230ccbbf26cadacc37',
        timeoutAt: 1761837624000,
        type: 'ismp.dispatched',
        origin: {
          chainId: 'urn:ocn:polkadot:2030',
          blockHash: '0xcaad4bf52104ed131e91793ef886144cd37ae4db2f45b15209567e4fe6306890',
          blockNumber: '9792939',
          timestamp: 1761826824000,
          event: {},
          outcome: 'Success',
        },
        destination: { chainId: 'urn:ocn:ethereum:1868' },
        waypoint: {
          chainId: 'urn:ocn:polkadot:2030',
          blockHash: '0xcaad4bf52104ed131e91793ef886144cd37ae4db2f45b15209567e4fe6306890',
          blockNumber: '9792939',
          timestamp: 1761826824000,
          event: {},
          outcome: 'Success',
        },
        decoded: {
          type: 'transact',
          method: 'setTokenAmount',
          args: {
            token: '0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441',
            tokenAmount: '97729523169462031775234935',
            vTokenAmount: '74902101342878744629136439',
          },
        },
      }
      const journey = toNewJourney(msg)

      expect(journey).toBeDefined()
      expect(journey.correlation_id).toBeDefined()
      expect(journey.status).toBe('sent')
      expect(journey.origin).toBe('urn:ocn:polkadot:2030')
      expect(journey.destination).toBe('urn:ocn:ethereum:1868')
      expect(journey.transact_calls).toBeDefined()
    })
  })
})

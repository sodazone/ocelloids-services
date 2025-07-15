import { NetworkURN } from '@/lib.js'
import { extractEvents, extractTxWithEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext } from '@/testing/xcm.js'
import { Binary } from 'polkadot-api'
import { from, of } from 'rxjs'
import { mapXcmSent } from './ops/common.js'
import { extractDmpSendByTx } from './ops/dmp.js'
import { extractXcmpSend } from './ops/xcmp.js'
import { extractXcmMessageData } from './tracking.js'

describe('extractXcmMessageData', () => {
  it('should extract xcm messages from dmp and hrmp', async () => {
    const blocks = from(testBlocksFrom('hydra/6783591.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
          expect(hashData[1].hash).toBeDefined()
          expect(hashData[1].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })

  it('should extract xcm messages from hrmp', async () => {
    const blocks = from(testBlocksFrom('astar/7898378.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })

  it('should extract xcm messages from dmp with topic id', async () => {
    const blocks = from(testBlocksFrom('bifrost/6360506.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })

  it('should extract xcm messages from dmp with topic id that does not accept topic id', async () => {
    const blocks = from(testBlocksFrom('interlay/7025155.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })

  it('should emit outbound for hydration xcmp to bridgehub', async () => {
    const origin = 'urn:ocn:local:2034' as NetworkURN
    const blocks = from(testBlocksFrom('hydra/8093942.cbor'))
    const getHrmp = () =>
      from([
        [
          {
            recipient: 1000,
            data: Binary.fromHex(
              '0x0004180008010000079e144c3204020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90017a08f37e359831035010a13010000079e144c32040016040d0100000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b100101020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90002010907040c13000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f62c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
            ),
          },
        ],
      ])

    const test$ = blocks.pipe(
      extractEvents(),
      extractXcmpSend(origin, getHrmp, apiContext),
      mapXcmSent(apiContext, origin),
    )
    const calls = vi.fn()
    await new Promise<void>((resolve) => {
      test$.subscribe({
        next: (msg) => {
          calls()
          expect(msg).toBeDefined()
          expect(msg.origin.blockNumber).toBeDefined()
          expect(msg.origin.blockHash).toBeDefined()
          expect(msg.origin.instructions).toBeDefined()
          expect(msg.origin.messageData).toBeDefined()
          expect(msg.origin.messageHash).toBeDefined()
          expect(msg.destination.chainId).toBeDefined()
          expect(msg.origin.timestamp).toBeDefined()
          expect(msg.sender?.signer.id).toBeDefined()
        },
        complete: () => {
          // should be 1 since we don't want dups
          expect(calls).toHaveBeenCalledTimes(1)
          resolve()
        },
      })
    })
  })

  it('should emit outbound for Polkadot with ExchangeAsset', async () => {
    const origin = 'urn:ocn:local:0' as NetworkURN
    const blocks = from(testBlocksFrom('polkadot/26879273.cbor'))
    const getDmp = () =>
      of([
        {
          msg: Binary.fromHex(
            '0x031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
          ),
        },
      ] as unknown as any)

    const test$ = blocks.pipe(
      extractTxWithEvents(),
      extractDmpSendByTx(origin, getDmp, apiContext),
      mapXcmSent(apiContext, origin),
    )
    const calls = vi.fn()
    await new Promise<void>((resolve) => {
      test$.subscribe({
        next: (msg) => {
          calls()
          expect(msg).toBeDefined()
          expect(msg.legs.length).toBe(2)
          expect(msg.legs[0].to).toBe('urn:ocn:local:1000')
          expect(msg.legs[0].type).toBe('hop')
          expect(msg.origin.blockNumber).toBeDefined()
          expect(msg.origin.blockHash).toBeDefined()
          expect(msg.origin.instructions).toBeDefined()
          expect(msg.origin.messageData).toBeDefined()
          expect(msg.origin.messageHash).toBeDefined()
          expect(msg.destination.chainId).toBeDefined()
          expect(msg.destination.chainId).toBe('urn:ocn:local:2030')
          expect(msg.origin.timestamp).toBeDefined()
          expect(msg.sender?.signer.id).toBeDefined()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          resolve()
        },
      })
    })
  })
})

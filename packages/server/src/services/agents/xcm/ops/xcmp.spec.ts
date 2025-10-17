import { Binary } from 'polkadot-api'
import { from } from 'rxjs'

import { NetworkURN } from '@/lib.js'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testApiContextFromMetadata, testBlocksFrom } from '@/testing/blocks.js'
import { apiContext, xcmpSend } from '@/testing/xcm.js'
import { extractXcmpSend } from './xcmp.js'

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract XCMP sent message', async () => {
      const { origin, blocks, getHrmp } = xcmpSend
      const calls = vi.fn()
      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.sender?.signer.id).toBeDefined()
            calls()
          },
          complete: () => {
            // should be 1 since we don't want dups
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract bridgehub xcmp sent', async () => {
      const origin = 'urn:ocn:local:1002' as NetworkURN
      const blocks = from(testBlocksFrom('bridgehub/5290865.cbor'))
      const getHrmp = () =>
        from([
          [
            {
              recipient: 1000,
              data: Binary.fromHex(
                '0x00052402040100000327d33b511301000002286bee000b010450250907040104020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90013000010433510e9fa0a16040d01020802010907040e010208010100c91f0c130100009e248456000d010208000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc481292cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc48129',
              ),
            },
          ],
        ])

      const calls = vi.fn()
      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
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

    it('should extract moonbeam xcmp sent', async () => {
      const origin = 'urn:ocn:local:2004' as NetworkURN
      const blocks = from(testBlocksFrom('moonbeam/11272812.cbor'))
      const getHrmp = () =>
        from([
          [
            {
              recipient: 2000,
              data: Binary.fromHex(
                '0x0004140104010200511f040a00130000b2d3595bf0060a13010200511f040a00130000b2d3595bf006000d010204000101005a071f642798f89d68b050384132eea7b65db483b00dbb05548d3ce472cfef482cfffc1445e3d88a8a26a65de4cbed2af329009aec64884a91c7d6009d0b30ae59',
              ),
            },
          ],
        ])

      const calls = vi.fn()
      const test$ = extractXcmpSend(
        origin,
        getHrmp,
        testApiContextFromMetadata('moonbeam.xcmv4.scale'),
      )(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
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

    it('should extract hydration xcmp sent from dispatch_permit', async () => {
      const origin = 'urn:ocn:local:2034' as NetworkURN
      const blocks = from(testBlocksFrom('hydra/8134854.cbor'))
      const getHrmp = () =>
        from([
          [
            {
              recipient: 2004,
              data: Binary.fromHex(
                '0x00041400080001040a0013000064a7b3b6e00d0002046e0300c30e9ca94cf52f3bf5692aacf81353a27052c46f00075b5d7d511a0a130001040a0013000064a7b3b6e00d000d01020800010300dca55ba0a9c4ea36f00f297f96eedebe798136a52cf0f57ac37e386c26ee737ecc8aaf96411c36f690ad97db390022b02d4af096b6041c0b01010102455448007d9bb4017844406ebc28b72d0327aaba2e2f869f000000000000000000040001040a00130000da493b717d0c130001040a00130000da493b717d0c00060107b090111d1da2252600810e6d0000404b4c0000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000008080000000000000000000000000000000000000000000000000000000000000000110d96e292b8000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c30e9ca94cf52f3bf5692aacf81353a27052c46f000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000001a517d5d5b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c41019d654000000000000000000000000c30e9ca94cf52f3bf5692aacf81353a27052c46f0000000000000000000000000000000000000000000000000000001a517d5d5b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000007d9bb4017844406ebc28b72d0327aaba2e2f869f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140d01020400010300dca55ba0a9c4ea36f00f297f96eedebe798136a52c940d663a900f3e07478cbe21a90fe86f88200351eb43daf4c78d434c04b9e999',
              ),
            },
          ],
        ])

      const calls = vi.fn()
      const test$ = extractXcmpSend(origin, getHrmp, apiContext)(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.instructions).toBeDefined()
            expect(msg.messageDataBuffer).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.sender?.signer.id).toBeDefined()
            expect(msg.sender?.signer.publicKey).toBeDefined()
          },
          complete: () => {
            // Hydration dispatch_permits sends 2 XCMs from the extrinsic
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })
  })
})

import { from, of } from 'rxjs'

import { extractEvents } from '@/common/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext, xcmpReceive } from '@/testing/xcm.js'
import { GenericXcmSentWithContext } from '../types.js'
import { extractParachainReceive, mapXcmSent } from './common.js'
import { getMessageId } from './util.js'
import { asVersionedXcm, fromXcmpFormat } from './xcm-format.js'

describe('common xcm operators', () => {
  describe('extract waypoints operator', () => {
    describe('mapXcmSent', () => {
      it('should extract stops for a V2 XCM message without hops', async () => {
        const calls = vi.fn()
        const moon5531424 =
          '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
        const buf = new Uint8Array(Buffer.from(moon5531424, 'hex'))
        const xcms = fromXcmpFormat(buf, apiContext)
        const test$ = mapXcmSent(
          apiContext,
          'urn:ocn:local:2004',
        )(
          from(
            xcms.map(
              (x) =>
                new GenericXcmSentWithContext({
                  event: {},
                  sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
                  blockHash: '0x01',
                  blockNumber: '32',
                  extrinsicPosition: 4,
                  recipient: 'urn:ocn:local:2104',
                  messageDataBuffer: buf,
                  messageHash: x.hash,
                  messageId: getMessageId(x),
                  instructions: {
                    bytes: x.data,
                    json: x.instructions,
                  },
                }),
            ),
          ),
        )

        await new Promise<void>((resolve) => {
          test$.subscribe({
            next: (msg) => {
              expect(msg).toBeDefined()
              expect(msg.waypoint.chainId).toBe('urn:ocn:local:2004')
              expect(msg.legs.length).toBe(1)
              expect(msg.legs[0]).toEqual({
                from: 'urn:ocn:local:2004',
                to: 'urn:ocn:local:2104',
                relay: 'urn:ocn:local:0',
                type: 'hrmp',
              })
              expect(msg.destination.chainId).toBe('urn:ocn:local:2104')
              calls()
            },
            complete: () => {
              expect(calls).toHaveBeenCalledTimes(2)
              resolve()
            },
          })
        })
      })

      it('should extract stops for a XCM message hopping with InitiateReserveWithdraw', async () => {
        const calls = vi.fn()
        const polka19505060 =
          '0310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c8e75728b841da22d8337ff5fadd1264f13addcdee755b01ce1a3afb9ef629b9a'
        const buf = new Uint8Array(Buffer.from(polka19505060, 'hex'))
        const xcm = asVersionedXcm(buf, apiContext)
        const test$ = mapXcmSent(
          apiContext,
          'urn:ocn:local:0',
        )(
          of(
            new GenericXcmSentWithContext({
              event: {},
              sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
              blockHash: '0x01',
              blockNumber: '32',
              extrinsicPosition: 4,
              recipient: 'urn:ocn:local:2034',
              messageDataBuffer: buf,
              messageHash: xcm.hash,
              messageId: getMessageId(xcm),
              instructions: {
                bytes: xcm.data,
                json: xcm.instructions,
              },
            }),
          ),
        )

        await new Promise<void>((resolve) => {
          test$.subscribe({
            next: (msg) => {
              expect(msg).toBeDefined()
              expect(msg.waypoint.chainId).toBe('urn:ocn:local:0')
              expect(msg.legs.length).toBe(2)
              expect(msg.legs[0]).toEqual({
                from: 'urn:ocn:local:0',
                to: 'urn:ocn:local:2034',
                type: 'hop',
              })
              expect(msg.legs[1]).toEqual({
                from: 'urn:ocn:local:2034',
                to: 'urn:ocn:local:1000',
                relay: 'urn:ocn:local:0',
                partialMessage:
                  '0x030813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
                type: 'hrmp',
              })
              expect(msg.destination.chainId).toBe('urn:ocn:local:1000')
              calls()
            },
            complete: () => {
              expect(calls).toHaveBeenCalledTimes(1)
              resolve()
            },
          })
        })
      })

      it('should extract stops for a XCM message hopping with DepositReserveAsset', async () => {
        const calls = vi.fn()
        const heiko5389341 =
          '0003100004000000000f251850c822be030a13000000000f120c286411df01000e010204010100411f081300010100511f000f120c286411df01000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c'
        const buf = new Uint8Array(Buffer.from(heiko5389341, 'hex'))
        const xcms = fromXcmpFormat(buf, apiContext)
        const test$ = mapXcmSent(
          apiContext,
          'urn:ocn:local:2085',
        )(
          from(
            xcms.map(
              (x) =>
                new GenericXcmSentWithContext({
                  event: {},
                  sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
                  blockHash: '0x01',
                  blockNumber: '32',
                  extrinsicPosition: 4,
                  recipient: 'urn:ocn:local:2004',
                  messageDataBuffer: buf,
                  messageHash: x.hash,
                  messageId: getMessageId(x),
                  instructions: {
                    bytes: x.data,
                    json: x.instructions,
                  },
                }),
            ),
          ),
        )

        await new Promise<void>((resolve) => {
          test$.subscribe({
            next: (msg) => {
              expect(msg).toBeDefined()
              expect(msg.waypoint.chainId).toBe('urn:ocn:local:2085')

              expect(msg.legs.length).toBe(2)
              expect(msg.legs[0]).toEqual({
                from: 'urn:ocn:local:2085',
                to: 'urn:ocn:local:2004',
                relay: 'urn:ocn:local:0',
                type: 'hop',
              })
              expect(msg.legs[1]).toEqual({
                from: 'urn:ocn:local:2004',
                to: 'urn:ocn:local:2000',
                relay: 'urn:ocn:local:0',
                partialMessage:
                  '0x03081300010100511f000f120c286411df01000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
                type: 'hrmp',
              })

              expect(msg.destination.chainId).toBe('urn:ocn:local:2000')
              calls()
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

  describe('extractParachainReceive', () => {
    it('should extract XCMP receive with outcome success', async () => {
      const { successBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractParachainReceive()(successBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract failed XCMP received message with error', async () => {
      const { failBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractParachainReceive()(failBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.timestamp).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract assets trapped info on XCMP received message for V4 assets', async () => {
      const { trappedBlocks } = xcmpReceive
      const calls = vi.fn()
      const test$ = extractParachainReceive()(trappedBlocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Fail')
            expect(msg.assetsTrapped).toBeDefined()
            expect(msg.assetsTrapped?.assets).toBeDefined()
            expect(msg.timestamp).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract dmpQueue.ExecutedDownward events', async () => {
      const blocks = from(testBlocksFrom('interlay/7025155.cbor'))
      const calls = vi.fn()
      const test$ = extractParachainReceive()(blocks.pipe(extractEvents()))

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.event).toBeDefined()
            expect(msg.messageHash).toBeDefined()
            expect(msg.outcome).toBeDefined()
            expect(msg.outcome).toBe('Success')
            expect(msg.assetsTrapped).toBeUndefined()
            expect(msg.timestamp).toBeDefined()
          },
          complete: () => {
            resolve()
            expect(calls).toHaveBeenCalledTimes(1)
          },
        })
      })
    })
  })
})

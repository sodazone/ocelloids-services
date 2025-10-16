import { filter, from, of } from 'rxjs'

import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext, apiContext_xcmv2, xcmpReceive } from '@/testing/xcm.js'

import { GenericXcmSentWithContext } from '../types/index.js'
import {
  extractParachainReceive,
  extractParachainReceiveByBlock,
  mapXcmSent,
  xcmMessagesSent,
} from './common.js'
import { getMessageId, matchEvent } from './util.js'
import { asVersionedXcm, fromXcmpFormat } from './xcm-format.js'

describe('common xcm operators', () => {
  describe('extract waypoints operator', () => {
    describe('mapXcmSent', () => {
      it('should extract stops for a V2 XCM message without hops', async () => {
        const calls = vi.fn()
        const moon5531424 =
          '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
        const buf = new Uint8Array(Buffer.from(moon5531424, 'hex'))
        const xcms = fromXcmpFormat(buf, apiContext_xcmv2)
        const test$ = mapXcmSent(
          apiContext_xcmv2,
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

      it('should extract stops for a V2 XCM message hop', async () => {
        const calls = vi.fn()
        const aca8222747 =
          '02100004000000000366d1f5750a1300000000cea2ebeb000e010004000100c91f081300010000cea2ebeb000d01000400010100769cac6c783b28e8ecf3c404af388996435b1f8aba90b0f363928caaf342142f'

        const buf = new Uint8Array(Buffer.from(aca8222747, 'hex'))
        const xcm = asVersionedXcm(buf, apiContext_xcmv2)
        const test$ = mapXcmSent(
          apiContext_xcmv2,
          'urn:ocn:local:2000',
        )(
          of(
            new GenericXcmSentWithContext({
              event: {},
              sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
              blockHash: '0x01',
              blockNumber: '32',
              extrinsicPosition: 4,
              recipient: 'urn:ocn:local:0',
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
              calls()
              expect(msg).toBeDefined()
              expect(msg.legs.length).toBe(2)
              expect(msg.legs[0]).toEqual({
                from: 'urn:ocn:local:2000',
                to: 'urn:ocn:local:0',
                type: 'hop',
              })
              expect(msg.legs[1]).toEqual({
                from: 'urn:ocn:local:0',
                to: 'urn:ocn:local:2034',
                type: 'vmp',
                partialMessage:
                  '0x02081300010000cea2ebeb000d01000400010100769cac6c783b28e8ecf3c404af388996435b1f8aba90b0f363928caaf342142f',
              })
            },
            complete: () => {
              expect(calls).toHaveBeenCalledTimes(1)
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

      it('should extract stops for XCM v5 bridge hop', async () => {
        const calls = vi.fn()
        const v5Msg =
          '00052402040100000327d33b511301000002286bee000b010450250907040104020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90013000010433510e9fa0a16040d01020802010907040e010208010100c91f0c130100009e248456000d010208000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc481292cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc48129'
        const buf = new Uint8Array(Buffer.from(v5Msg, 'hex'))
        const xcms = fromXcmpFormat(buf, apiContext)

        const test$ = mapXcmSent(
          apiContext,
          'urn:ocn:local:1002',
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
                  recipient: 'urn:ocn:local:1000',
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
              calls()
              expect(msg).toBeDefined()
              expect(msg.waypoint.chainId).toBe('urn:ocn:local:1002')

              expect(msg.legs.length).toBe(2)
              expect(msg.legs[0]).toEqual({
                from: 'urn:ocn:local:1002',
                to: 'urn:ocn:local:1000',
                relay: 'urn:ocn:local:0',
                type: 'hop',
              })
              expect(msg.legs[1]).toEqual({
                from: 'urn:ocn:local:1000',
                to: 'urn:ocn:local:2034',
                relay: 'urn:ocn:local:0',
                partialMessage:
                  '0x050c130100009e248456000d010208000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc48129',
                type: 'hrmp',
              })

              expect(msg.destination.chainId).toBe('urn:ocn:local:2034')
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
      const blocks = from(testBlocksFrom('hydra/7179874.cbor'))
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

    it('should extract DMP receive by block', async () => {
      const blocks = from(testBlocksFrom('assethub/9276853.cbor'))
      const calls = vi.fn()
      const test$ = extractParachainReceiveByBlock('urn:ocn:polkadot:1000')(blocks)

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
  })

  describe('xcmMessagesSent', () => {
    it('work with Frontier events', async () => {
      const block$ = from(testBlocksFrom('moonbeam/12962193.cbor'))
      const test$ = xcmMessagesSent()(
        block$.pipe(
          extractEvents(),
          filter((event) => matchEvent(event, 'XcmpQueue', 'XcmpMessageSent')),
        ),
      )
      const errorCb = vi.fn()
      await new Promise<void>((resolve) => {
        test$.subscribe({
          error: (_err) => {
            errorCb()
          },
          complete: () => {
            expect(errorCb).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })
})

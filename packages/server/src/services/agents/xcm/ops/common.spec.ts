import { jest } from '@jest/globals'

import { from, of } from 'rxjs'

import { registry } from '@/testing/xcm.js'
import { GenericXcmSentWithContext } from '../types.js'
import { mapXcmSent } from './common.js'
import { getMessageId } from './util.js'
import { asVersionedXcm, fromXcmpFormat } from './xcm-format.js'

describe('extract waypoints operator', () => {
  describe('mapXcmSent', () => {
    it('should extract stops for a V2 XCM message without hops', (done) => {
      const calls = jest.fn()

      const moon5531424 =
        '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
      const buf = new Uint8Array(Buffer.from(moon5531424, 'hex'))

      const xcms = fromXcmpFormat(buf, registry)
      const test$ = mapXcmSent(
        'test-sub',
        registry,
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
                extrinsicId: '32-4',
                recipient: 'urn:ocn:local:2104',
                messageData: buf,
                messageHash: x.hash.toHex(),
                messageId: getMessageId(x),
                instructions: {
                  bytes: x.toU8a(),
                  json: x.toHuman(),
                },
              }),
          ),
        ),
      )

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
          done()
        },
      })
    })

    it('should extract stops for a XCM message hopping with InitiateReserveWithdraw', (done) => {
      const calls = jest.fn()

      const polka19505060 =
        '0310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c8e75728b841da22d8337ff5fadd1264f13addcdee755b01ce1a3afb9ef629b9a'
      const buf = new Uint8Array(Buffer.from(polka19505060, 'hex'))

      const xcm = asVersionedXcm(buf, registry)
      const test$ = mapXcmSent(
        'test-sub',
        registry,
        'urn:ocn:local:0',
      )(
        of(
          new GenericXcmSentWithContext({
            event: {},
            sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
            blockHash: '0x01',
            blockNumber: '32',
            extrinsicId: '32-4',
            recipient: 'urn:ocn:local:2034',
            messageData: buf,
            messageHash: xcm.hash.toHex(),
            messageId: getMessageId(xcm),
            instructions: {
              bytes: xcm.toU8a(),
              json: xcm.toHuman(),
            },
          }),
        ),
      )

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
            type: 'hop',
          })
          expect(msg.destination.chainId).toBe('urn:ocn:local:1000')
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract stops for a XCM message hopping with DepositReserveAsset', (done) => {
      const calls = jest.fn()

      const heiko5389341 =
        '0003100004000000000f251850c822be030a13000000000f120c286411df01000e010204010100411f081300010100511f000f120c286411df01000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c'
      const buf = new Uint8Array(Buffer.from(heiko5389341, 'hex'))

      const xcms = fromXcmpFormat(buf, registry)
      const test$ = mapXcmSent(
        'test-sub',
        registry,
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
                extrinsicId: '32-4',
                recipient: 'urn:ocn:local:2004',
                messageData: buf,
                messageHash: x.hash.toHex(),
                messageId: getMessageId(x),
                instructions: {
                  bytes: x.toU8a(),
                  json: x.toHuman(),
                },
              }),
          ),
        ),
      )

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
            type: 'hop',
          })

          expect(msg.destination.chainId).toBe('urn:ocn:local:2000')
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })
})

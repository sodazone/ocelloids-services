import { jest } from '@jest/globals'
import { extractEvents, extractTxWithEvents } from '@sodazone/ocelloids-sdk'

import { from } from 'rxjs'

import {
  bridgeInPolkadot,
  bridgeOutAcceptedKusama,
  bridgeOutDeliveredKusama,
  registry,
  relayHrmpReceiveKusama,
  relayHrmpReceivePolkadot,
  xcmpReceiveKusamaBridgeHub,
  xcmpReceivePolkadotAssetHub,
  xcmpSendKusamaAssetHub,
  xcmpSendPolkadotBridgeHub,
} from '../../../../testing/bridge/blocks.js'

import {
  extractBridgeMessageAccepted,
  extractBridgeMessageDelivered,
  extractBridgeReceive,
} from './pk-bridge.js'
import { extractRelayReceive } from './relay.js'
import { extractXcmpReceive, extractXcmpSend } from './xcmp.js'

import { NetworkURN } from '../../../types.js'
import { GenericXcmSentWithContext } from '../types.js'
import { mapXcmSent } from './common.js'
import { getMessageId } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract XCMP sent message on Kusama', (done) => {
      const { origin, blocks, getHrmp } = xcmpSendKusamaAssetHub

      const calls = jest.fn()

      const test$ = extractXcmpSend(origin, getHrmp, registry)(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.instructions).toBeDefined()
          expect(msg.messageData).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract XCMP sent message on Polkadot', (done) => {
      const { origin, blocks, getHrmp } = xcmpSendPolkadotBridgeHub

      const calls = jest.fn()

      const test$ = extractXcmpSend(origin, getHrmp, registry)(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.instructions).toBeDefined()
          expect(msg.messageData).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })

  describe('extractXcmpReceive', () => {
    it('should extract XCMP receive with outcome success on Kusama', (done) => {
      const calls = jest.fn()

      const test$ = extractXcmpReceive()(xcmpReceiveKusamaBridgeHub.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract XCMP receive with outcome success on Polkadot', (done) => {
      const calls = jest.fn()

      const test$ = extractXcmpReceive()(xcmpReceivePolkadotAssetHub.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(2)
          done()
        },
      })
    })
  })
})

describe('relay operator', () => {
  describe('extractRelayReceive', () => {
    it('should extract HRMP messages when they arrive on the Kusama relay chain', (done) => {
      const { blocks, origin, messageControl, destination } = relayHrmpReceiveKusama

      const calls = jest.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        registry,
      )(blocks.pipe(extractTxWithEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          expect(msg.recipient).toBe(destination)
          expect(msg.extrinsicId).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          expect(msg.error).toBeNull()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should extract HRMP messages when they arrive on the Polkadot relay chain', (done) => {
      const { blocks, origin, messageControl, destination } = relayHrmpReceivePolkadot

      const calls = jest.fn()

      const test$ = extractRelayReceive(
        origin as NetworkURN,
        messageControl,
        registry,
      )(blocks.pipe(extractTxWithEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          expect(msg.recipient).toBe(destination)
          expect(msg.extrinsicId).toBeDefined()
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          expect(msg.error).toBeNull()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(2)
          done()
        },
      })
    })
  })
})

describe('bridge operator', () => {
  describe('extractBridgeMessageAccepted', () => {
    it('should extract accepted bridge messages on Bridge Hub', (done) => {
      const { origin, destination, blocks, getStorage } = bridgeOutAcceptedKusama

      const calls = jest.fn()

      const test$ = extractBridgeMessageAccepted(
        origin as NetworkURN,
        registry,
        getStorage,
      )(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.messageHash).toBeDefined()
          expect(msg.recipient).toBeDefined()
          expect(msg.recipient).toBe(destination)
          expect(msg.forwardId).toBeDefined()
          expect(msg.messageId).toBeDefined()
          expect(msg.bridgeKey).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })

  describe('extractBridgeMessageDelivered', () => {
    it('should extract bridge message delivered event', (done) => {
      const { origin, blocks } = bridgeOutDeliveredKusama

      const calls = jest.fn()

      const test$ = extractBridgeMessageDelivered(
        origin as NetworkURN,
        registry,
      )(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.chainId).toBeDefined()
          expect(msg.chainId).toBe(origin)
          expect(msg.bridgeKey).toBeDefined()
          calls()
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })

  describe('extractBridgeReceive', () => {
    it('should extract bridge message receive events when message arrives on receving Bridge Hub', (done) => {
      const { origin, blocks } = bridgeInPolkadot

      const calls = jest.fn()
      const test$ = extractBridgeReceive(origin as NetworkURN)(blocks.pipe(extractEvents()))

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined()
          expect(msg.blockNumber).toBeDefined()
          expect(msg.blockHash).toBeDefined()
          expect(msg.event).toBeDefined()
          expect(msg.chainId).toBeDefined()
          expect(msg.chainId).toBe(origin)
          expect(msg.outcome).toBeDefined()
          expect(msg.outcome).toBe('Success')
          expect(msg.error).toBeNull()
          expect(msg.bridgeKey).toBeDefined()
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

describe('mapXcmSent', () => {
  it('should extract stops for XCM with ExportMessage instruction', (done) => {
    const calls = jest.fn()

    const ksmAHBridge =
      '0003180004000100000740568a4a5f13000100000740568a4a5f0026020100a10f1401040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab140d0100010100a10f2c4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d'
    const buf = new Uint8Array(Buffer.from(ksmAHBridge, 'hex'))

    const xcms = fromXcmpFormat(buf, registry)
    const test$ = mapXcmSent(
      'test-sub',
      registry,
      'urn:ocn:kusama:1000',
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
              recipient: 'urn:ocn:kusama:1002',
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
        expect(msg.waypoint.chainId).toBe('urn:ocn:kusama:1000')
        expect(msg.legs.length).toBe(3)
        expect(msg.destination.chainId).toBe('urn:ocn:polkadot:1000')
        calls()
      },
      complete: () => {
        expect(calls).toHaveBeenCalledTimes(1)
        done()
      },
    })
  })

  it('should extract stops for bridged XCM', (done) => {
    const calls = jest.fn()

    const dotBridgeHubXcmOut =
      '0003200b0104352509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab'
    const buf = new Uint8Array(Buffer.from(dotBridgeHubXcmOut, 'hex'))

    const xcms = fromXcmpFormat(buf, registry)
    const test$ = mapXcmSent(
      'test-sub',
      registry,
      'urn:ocn:polkadot:1002',
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
              recipient: 'urn:ocn:polkadot:1000',
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
        expect(msg.waypoint.chainId).toBe('urn:ocn:polkadot:1002')
        expect(msg.legs.length).toBe(1)
        expect(msg.destination.chainId).toBe('urn:ocn:polkadot:1000')
        expect(msg.forwardId).toBeDefined()
        calls()
      },
      complete: () => {
        expect(calls).toHaveBeenCalledTimes(1)
        done()
      },
    })
  })
})

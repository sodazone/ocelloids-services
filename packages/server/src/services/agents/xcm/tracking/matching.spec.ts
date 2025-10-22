import { MemoryLevel } from 'memory-level'

import { Egress } from '@/services/egress/index.js'
import { Janitor } from '@/services/scheduling/janitor.js'
import { jsonEncoded, LevelDB, Services, SubLevel } from '@/services/types.js'
import { twoHopSwap } from '@/testing/2-hop-swap.js'
import { moonbeamCentrifugeHydra } from '@/testing/hops.js'
import { acalaHydra } from '@/testing/hops-acala-hydra.js'
import { hydraAstarBifrost } from '@/testing/hops-hydra-bifrost.js'
import { hydraAssetHubBridgeHub } from '@/testing/hops-hydra-bridgehub.js'
import { hydraPolkadotInterlay } from '@/testing/hops-ump-dmp.js'
import { bifrostHydraVmp } from '@/testing/hops-vmp.js'
import {
  hydraMoonMessages,
  matchMessages,
  moonBifrostMessages,
  umpHydraPolkadotMessages,
} from '@/testing/matching.js'
import { kusamaToPolkadotBridgeMessages } from '@/testing/pk-bridge.js'
import { createServices } from '@/testing/services.js'
import { ethereumToHydrationMessages } from '@/testing/snowbridge.js'
import { prefixes, XcmBridge, XcmInbound, XcmNotificationType, XcmSent } from '../types/index.js'
import { MatchingEngine } from './matching.js'

type OD = { origin: string; destination: string }

describe('message matching engine', () => {
  let engine: MatchingEngine
  let db: LevelDB
  let outDb: SubLevel<XcmSent>
  let bridgeDb: SubLevel<XcmBridge>
  let services: Services

  const msgOdCb = vi.fn()
  const msgTypeCb = vi.fn()
  const cb = vi.fn((msg) => {
    msgTypeCb(msg.type)
    msgOdCb({
      origin: msg.origin.chainId,
      destination: msg.destination.chainId,
    })
  })
  const schedule = vi.fn()

  function expectEvents(events: XcmNotificationType[]) {
    for (const [i, event] of events.entries()) {
      expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(i + 1, event)
    }
  }

  function expectOd(calls: number, od: OD) {
    for (let i = 0; i < calls; i++) {
      expect(msgOdCb).toHaveBeenNthCalledWith<[OD]>(i + 1, od)
    }
  }

  async function expectNoLeftover() {
    const leftoverKeys = await outDb.keys().all()
    const bridgeKeys = await bridgeDb.keys().all()
    expect(leftoverKeys.length).toBe(0)
    expect(bridgeKeys.length).toBe(0)
  }

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    db = new MemoryLevel() as LevelDB
    outDb = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded) as SubLevel<XcmSent>
    bridgeDb = db.sublevel<string, XcmBridge>(
      prefixes.matching.bridgeAccepted,
      jsonEncoded,
    ) as SubLevel<XcmBridge>
    engine = new MatchingEngine(
      {
        ...services,
        egress: {} as unknown as Egress,
        db,
        janitor: {
          on: vi.fn(),
          schedule,
        } as unknown as Janitor,
      },
      cb,
    )
  })

  it('should match outbound and inbound', async () => {
    const { origin, destination } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expectEvents(['xcm.sent', 'xcm.received'])
    expect((await outDb.keys().all()).length).toBe(0)
  })

  it('should match out of order', async () => {
    const { origin, received } = umpHydraPolkadotMessages

    await engine.onInboundMessage(received)
    await engine.onOutboundMessage(origin)
    await Promise.all([engine.onInboundMessage(received), engine.onOutboundMessage(origin)])
    await Promise.all([engine.onInboundMessage(received), engine.onOutboundMessage(origin)])
    await Promise.all([engine.onInboundMessage(received), engine.onOutboundMessage(origin)])

    expect(cb).toHaveBeenCalledTimes(8)

    expect((await outDb.keys().all()).length).toBe(0)
  })

  it('should match inbound and outbound with hop', async () => {
    const { sent, received } = moonBifrostMessages

    await engine.onInboundMessage(received)
    await engine.onOutboundMessage(sent)

    expectEvents(['xcm.sent', 'xcm.hop'])
  })

  it('should skip duplicated outbound message', async () => {
    const { origin } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onOutboundMessage(origin)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should work async concurrently', async () => {
    const { origin, destination } = matchMessages

    await Promise.all([engine.onOutboundMessage(origin), engine.onInboundMessage(destination)])

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match outbound and relay', async () => {
    const { origin, relay } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(relay)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound', async () => {
    const { origin, relay } = matchMessages

    await engine.onRelayedMessage(relay)
    await engine.onOutboundMessage(origin)
    expect(schedule).toHaveBeenCalledTimes(2)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound and inbound', async () => {
    const { origin, relay, destination } = matchMessages

    await engine.onRelayedMessage(relay)
    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expect(schedule).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('should match outbound and inbound by message hash', async () => {
    const { origin, destination } = matchMessages
    const omsg: XcmSent = {
      ...origin,
      messageId: undefined,
    }
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }

    await engine.onOutboundMessage(omsg)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match with messageId on outbound and only message hash on inbound', async () => {
    const { origin, destination } = matchMessages
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match hop messages with heuristics', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = hydraAstarBifrost

    await engine.onRelayedMessage(relay0)
    await engine.onOutboundMessage(sent)
    await engine.onMessageData({
      hash: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
      data: '0x04100104010100591f001b063c6c60acd23f191e020a13010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    })

    await engine.onInboundMessage(hopIn)
    await engine.onRelayedMessage(relay1)
    await engine.onOutboundMessage(hopOut)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.relayed', 'xcm.hop', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:polkadot:2034', destination: 'urn:ocn:polkadot:2030' })
    await expectNoLeftover()
  })

  it('should match hop messages hydra to bridgehub', async () => {
    const { sent, hopIn, hopOut, received } = hydraAssetHubBridgeHub

    await engine.onOutboundMessage(sent)
    await engine.onOutboundMessage(hopOut)
    await engine.onInboundMessage(hopIn)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    expectOd(4, { origin: 'urn:ocn:local:2034', destination: 'urn:ocn:local:1002' })
    await expectNoLeftover()
  })

  it('should match hop messages with heuristics on different XCM versions', async () => {
    const { sent, received } = acalaHydra

    await engine.onOutboundMessage(sent)
    await engine.onMessageData({
      hash: '0x55e05f9fceada3f9b41bdfc49bb6701a79ac0dd7adac8a9710c4968d32500f3f',
      data: '0x0314010400010000037bf1bf5b0a1300010000cea2ebeb000d01020400010100769cac6c783b28e8ecf3c404af388996435b1f8aba90b0f363928caaf342142f2c75823bfd849f1325d890a0bf83051831d43785e2f7e5cd21381c330b23aff04f',
      topicId: '0x75823bfd849f1325d890a0bf83051831d43785e2f7e5cd21381c330b23aff04f',
    })

    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.received'])
    expectOd(2, { origin: 'urn:ocn:local:2000', destination: 'urn:ocn:local:2034' })
    await expectNoLeftover()
  })

  it('should match hop messages with 2 potential received', async () => {
    const { sent, hopIn, received0, received1 } = bifrostHydraVmp

    await engine.onOutboundMessage(sent)

    await engine.onMessageData({
      hash: '0xa01291c635e6a40c554ca9bf098ea09257b14d91d7e0308837b4fdc36953bd9f',
      data: '0x03140104000100000b0033b48883130a13000100000b097290d1c109000d0102040001010016842e1c98a7990f532c5b814228dc1040af73f227842a82ab6b9bcdab0cba4e2cde234382de1c58721e26dda4f2fed76cfa11ad757616a1ab82979b0e70c2ca2d',
    })

    await engine.onInboundMessage(hopIn)
    await engine.onInboundMessage(received0)
    await engine.onInboundMessage(received1)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.received'])
    expectOd(3, { origin: 'urn:ocn:polkadot:2030', destination: 'urn:ocn:polkadot:2034' })
    await expectNoLeftover()
  })

  it('should match hop messages with topic id', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamCentrifugeHydra

    await engine.onOutboundMessage({ ...sent, messageId: '0x010203' })
    await engine.onRelayedMessage(relay0)
    await engine.onRelayedMessage(relay1)
    await engine.onInboundMessage({ ...hopIn, messageId: '0x010203' })
    await engine.onOutboundMessage({ ...hopOut, messageId: '0x010203' })
    await engine.onInboundMessage({ ...received, messageId: '0x010203' })

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:polkadot:2004', destination: 'urn:ocn:polkadot:2034' })
    await expectNoLeftover()
  })

  it('should match hop messages without relay', async () => {
    const { received, hop, sent } = hydraMoonMessages

    await engine.onOutboundMessage(sent)
    await engine.onInboundMessage(hop)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.received'])
  })

  it('should match hop messages with concurrent message on hop stop', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamCentrifugeHydra

    await engine.onOutboundMessage(sent)
    await engine.onRelayedMessage(relay0)
    await Promise.all([engine.onInboundMessage(hopIn), engine.onOutboundMessage(hopOut)])
    await engine.onRelayedMessage(relay1)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.relayed', 'xcm.received'])
    await expectNoLeftover()
  })

  it('should match hop messages with concurrent message on hop stop and relay out of order', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamCentrifugeHydra

    await engine.onRelayedMessage(relay0)
    await engine.onOutboundMessage(sent)
    await engine.onRelayedMessage(relay1)

    await Promise.all([engine.onInboundMessage(hopIn), engine.onOutboundMessage(hopOut)])

    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    await expectNoLeftover()
  })

  it('should match hop messages out of order', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamCentrifugeHydra

    await engine.onRelayedMessage(relay0)
    await engine.onOutboundMessage(sent)

    await engine.onInboundMessage(received)
    await engine.onRelayedMessage(relay1)
    await engine.onInboundMessage(hopIn)
    await engine.onOutboundMessage(hopOut)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.received', 'xcm.hop', 'xcm.relayed', 'xcm.hop'])
    expectOd(6, { origin: 'urn:ocn:polkadot:2004', destination: 'urn:ocn:polkadot:2034' })
    await expectNoLeftover()
  })

  it('should match 2 hops', async () => {
    const { sent, hopIn2034, hopOut2034, hopIn1000, hopOut1000, received } = twoHopSwap

    await engine.onOutboundMessage(sent)
    await engine.onMessageData({
      hash: '0xe5464e6ca180782f200980a7d8a419e7a73dcbef1342c92a81d55e58212349e3',
      data: '0x041400040002043205011f00f2a641000a130002043205011f00eaa64100000e01010002043205011f00010100591f0813010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
      topicId: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    })
    await engine.onOutboundMessage(hopOut2034)
    await engine.onInboundMessage(hopIn2034)

    await engine.onMessageData({
      hash: '0xa6a9047ac211d27c2ed28b65e9db76e1dc76266feeabd2b2ee0f46e6bf485648',
      topicId: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
      data: '0x05140104010300a10f043205011f003ead38000a13010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    })
    await engine.onInboundMessage(hopIn1000)
    await engine.onOutboundMessage(hopOut1000)

    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:local:0', destination: 'urn:ocn:local:2006' })
    await expectNoLeftover()
  })

  it('should match ump-dmp hops when hop is emitted first', async () => {
    const { sent, hopIn, hopOut, received } = hydraPolkadotInterlay

    await engine.onInboundMessage(hopIn)
    await engine.onOutboundMessage(hopOut)
    await engine.onOutboundMessage(sent)
    await engine.onMessageData({
      hash: '0xec2bc1953d032d6ac959ff711e0df632251b75a61bec7a6e103f775db2f4a462',
      topicId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
      data: '0x031401040001000007bcef0ba2280a130001000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a2c404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    })
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.sent', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    await expectNoLeftover()
  })

  it('should match pk bridge messages', async () => {
    const { sent, bridgeXcmIn, bridgeAccepted, bridgeReceived, bridgeXcmOut, received } =
      kusamaToPolkadotBridgeMessages

    await engine.onOutboundMessage(sent)
    await engine.onBridgeOutboundAccepted(bridgeAccepted)
    await engine.onInboundMessage(bridgeXcmIn)

    await engine.onOutboundMessage(bridgeXcmOut)
    await engine.onBridgeInbound(bridgeReceived)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.bridge', 'xcm.hop', 'xcm.hop', 'xcm.bridge', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:kusama:1000', destination: 'urn:ocn:polkadot:1000' })
    await expectNoLeftover()
  })

  it('should match snowbridge ethereum to hydration messages', async () => {
    const {
      ethereumSent,
      bridgeHubReceived,
      bridgeHubXcmOut,
      assetHubXcmIn,
      assetHubXcmOut,
      hydrationReceived,
    } = ethereumToHydrationMessages

    await engine.onSnowbridgeOriginOutbound(ethereumSent)
    await engine.onOutboundMessage(bridgeHubXcmOut)
    await engine.onBridgeInbound(bridgeHubReceived)

    await engine.onOutboundMessage(assetHubXcmOut)
    await engine.onInboundMessage(assetHubXcmIn)
    await engine.onInboundMessage(hydrationReceived)

    expectEvents(['xcm.bridge', 'xcm.hop', 'xcm.bridge', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:ethereum:1', destination: 'urn:ocn:polkadot:2034' })
    await expectNoLeftover()
  })
})

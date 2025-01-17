import { MemoryLevel as Level } from 'memory-level'

import { Egress } from '@/services/egress/index.js'
import { Janitor } from '@/services/persistence/level/janitor.js'
import { Services, SubLevel, jsonEncoded } from '@/services/types.js'
import { hydraMoonMessages, matchMessages, moonBifrostMessages } from '@/testing/matching.js'
import { createServices } from '@/testing/services.js'

import { hydraAstarBifrost } from '@/testing/hops-hydra-bifrost.js'
import { bifrostHydraVmp } from '@/testing/hops-vmp.js'
import { moonbeamCentrifugeHydra } from '@/testing/hops.js'
import { MatchingEngine } from './matching.js'
import { XcmInbound, XcmNotificationType, XcmSent, prefixes } from './types.js'

type OD = { origin: string; destination: string }

describe('message matching engine', () => {
  let engine: MatchingEngine
  let db: Level
  let outDb: SubLevel<XcmSent>
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
    expect(leftoverKeys.length).toBe(0)
  }

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    db = new Level()
    outDb = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded)
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

  it('should match inbound and outbound', async () => {
    const { origin, destination } = matchMessages

    await engine.onInboundMessage(destination)
    await engine.onOutboundMessage(origin)

    expectEvents(['xcm.sent', 'xcm.received'])
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

    expectEvents(['xcm.relayed', 'xcm.sent', 'xcm.hop', 'xcm.relayed', 'xcm.hop', 'xcm.received'])
    expectOd(6, { origin: 'urn:ocn:polkadot:2034', destination: 'urn:ocn:polkadot:2030' })
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

    expectEvents(['xcm.relayed', 'xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.received'])
    await expectNoLeftover()
  })
})

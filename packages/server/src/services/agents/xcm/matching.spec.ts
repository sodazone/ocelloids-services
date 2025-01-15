import { MemoryLevel as Level } from 'memory-level'

import { Egress } from '@/services/egress/index.js'
import { Janitor } from '@/services/persistence/level/janitor.js'
import { Services, SubLevel, jsonEncoded } from '@/services/types.js'
import { hydraMoonMessages, matchMessages, moonBifrostMessages, realHopMessages } from '@/testing/matching.js'
import { createServices } from '@/testing/services.js'

import { moonbeamHydraCentrifuge } from '@/testing/hops.js'
import { MatchingEngine } from './matching.js'
import { XcmInbound, XcmNotificationType, XcmSent, prefixes } from './types.js'

describe('message matching engine', () => {
  let engine: MatchingEngine
  let db: Level
  let outDb: SubLevel<XcmSent>
  let services: Services

  const msgTypeCb = vi.fn()
  const cb = vi.fn((msg) => msgTypeCb(msg.type))
  const schedule = vi.fn()

  function expectEvents(events: XcmNotificationType[]) {
    for (const [i, event] of events.entries()) {
      expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(i + 1, event)
    }
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

  it('should match hop messages', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamHydraCentrifuge

    await engine.onOutboundMessage(sent)
    await engine.onRelayedMessage(relay0)

    await engine.onInboundMessage(hopIn)
    await engine.onOutboundMessage(hopOut)
    await engine.onRelayedMessage(relay1)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.relayed', 'xcm.received'])
  })

  it('should match hop messages with topic id', async () => {
    const { origin, hopin, hopout } = realHopMessages

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop'])
  })

  it('should match hop messages without topic id', async () => {
    const { origin, hopin, hopout } = realHopMessages

    delete origin.messageId
    delete hopin.messageId
    delete hopout.messageId

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop'])
  })

  it('should match hop messages without relay', async () => {
    const { received, hop, sent } = hydraMoonMessages

    await engine.onOutboundMessage(sent)
    await engine.onInboundMessage(hop)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.received'])
  })

  it('should match hop messages with concurrent message on hop stop', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamHydraCentrifuge

    await engine.onOutboundMessage(sent)
    await engine.onRelayedMessage(relay0)
    await Promise.all([engine.onInboundMessage(hopIn), engine.onOutboundMessage(hopOut)])
    await engine.onRelayedMessage(relay1)
    await engine.onInboundMessage(received)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.relayed', 'xcm.received'])
  })

  it('should match hop messages with concurrent message on hop stop and relay out of order', async () => {
    const { sent, relay0, hopIn, hopOut, relay1, received } = moonbeamHydraCentrifuge

    await engine.onRelayedMessage(relay0)
    await engine.onOutboundMessage(sent)
    await engine.onRelayedMessage(relay1)

    await Promise.all([engine.onInboundMessage(hopIn), engine.onOutboundMessage(hopOut)])

    await engine.onInboundMessage(received)

    expect(cb).toHaveBeenCalledTimes(6)
  })
})

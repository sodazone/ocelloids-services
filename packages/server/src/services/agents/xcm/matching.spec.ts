import { MemoryLevel as Level } from 'memory-level'

import { Egress } from '@/services/egress/index.js'
import { Janitor } from '@/services/persistence/level/janitor.js'
import { Services, jsonEncoded } from '@/services/types.js'
import { matchHopMessages, matchMessages, realHopMessages } from '@/testing/matching.js'
import { createServices } from '@/testing/services.js'

import { AbstractSublevel } from 'abstract-level'
import { MatchingEngine } from './matching.js'
import { XcmInbound, XcmMessagePayload, XcmNotificationType, XcmSent, prefixes } from './types.js'

describe('message matching engine', () => {
  let engine: MatchingEngine
  let db: Level
  let services: Services
  let outbound: AbstractSublevel<Level, Buffer | Uint8Array | string, string, XcmSent>
  const cb = vi.fn((_: XcmMessagePayload) => {
    /* empty */
  })
  const schedule = vi.fn(() => {
    /* empty */
  })

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(() => {
    cb.mockReset()
    schedule.mockReset()

    db = new Level()
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

    outbound = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded)
  })

  it('should match inbound and outbound', async () => {
    const { origin, destination, subscriptionId } = matchMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(2)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match outbound and inbound', async () => {
    const { origin, destination, subscriptionId } = matchMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onInboundMessage(destination)
    await engine.onOutboundMessage(origin)

    expect(cb).toHaveBeenCalledTimes(2)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should skip duplicated outbound message', async () => {
    const { origin } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onOutboundMessage(origin)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should work async concurrently', async () => {
    const { origin, destination, subscriptionId } = matchMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await Promise.all([engine.onOutboundMessage(origin), engine.onInboundMessage(destination)])

    expect(cb).toHaveBeenCalledTimes(2)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match outbound and relay', async () => {
    await engine.onOutboundMessage(matchMessages.origin)
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound', async () => {
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay)
    await engine.onOutboundMessage(matchMessages.origin)
    expect(schedule).toHaveBeenCalledTimes(2)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound and inbound', async () => {
    const { origin, relay, destination, subscriptionId } = matchMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onRelayedMessage(subscriptionId, relay)
    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expect(schedule).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenCalledTimes(3)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match outbound and inbound by message hash', async () => {
    const { origin, destination, subscriptionId } = matchMessages
    const omsg: XcmSent = {
      ...origin,
      messageId: undefined,
    }
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onOutboundMessage(omsg)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match with messageId on outbound and only message hash on inbound', async () => {
    const { origin, destination, subscriptionId } = matchMessages
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match hop messages', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay0)

    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)
    await engine.onRelayedMessage(subscriptionId, relay2)
    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(6)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match hop messages', async () => {
    const msgTypeCb = vi.fn((_: XcmNotificationType) => {
      /* empty */
    })
    cb.mockImplementation((msg) => msgTypeCb(msg.type))

    const { origin, hopin, hopout } = realHopMessages

    await engine.onOutboundMessage(origin)

    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)

    expect(cb).toHaveBeenCalledTimes(3)
    expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(1, 'xcm.sent')
    expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(2, 'xcm.hop')
    expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(3, 'xcm.hop')
  })

  it('should match hop messages with concurrent message on hop stop', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay0)
    await Promise.all([engine.onInboundMessage(hopin), engine.onOutboundMessage(hopout)])
    await engine.onRelayedMessage(subscriptionId, relay2)
    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(6)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should match hop messages with concurrent message on hop stop and relay out of order', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages
    const idKey = `${subscriptionId}:${origin.messageId}:${destination.chainId}`
    const hashKey = `${subscriptionId}:${origin.waypoint.messageHash}:${destination.chainId}`

    await engine.onRelayedMessage(subscriptionId, relay0)
    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay2)

    await Promise.all([engine.onInboundMessage(hopin), engine.onOutboundMessage(hopout)])

    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(6)
    await expect(outbound.get(idKey)).rejects.toBeDefined()
    await expect(outbound.get(hashKey)).rejects.toBeDefined()
  })

  it('should clean up stale data', async () => {
    async function count() {
      const iterator = db.iterator()
      await iterator.all()
      return iterator.count
    }

    for (let i = 0; i < 100; i++) {
      await engine.onInboundMessage({
        ...matchMessages.destination,
        subscriptionId: 'z.transfers:' + i,
      })
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: 'baba-yaga-1:' + i,
      })
      const r = (Math.random() + 1).toString(36).substring(7)
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: r + i,
      })
    }
    expect(await count()).toBe(600)

    for (let i = 0; i < 100; i++) {
      await engine.clearPendingStates('z.transfers:' + i)
      await engine.clearPendingStates('baba-yaga-1:' + i)
    }
    expect(await count()).toBe(200)
  })
})

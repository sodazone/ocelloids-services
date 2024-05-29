import { jest } from '@jest/globals'

import '../../testing/network.js'

import { of, throwError } from 'rxjs'

import { _services } from '../../testing/services.js'
import { AgentServiceMode } from '../../types.js'
import { LocalAgentService } from '../agents/local.js'
import { AgentService } from '../agents/types.js'
import { SubsStore } from '../persistence/subs'
import { Services } from '../types.js'
import type { Switchboard } from './switchboard.js'
import { Subscription } from './types'

/* TODO: move to xcm agent tests
jest.unstable_mockModule('./ops/xcmp.js', () => {
  return {
    extractXcmpSend: jest.fn(),
    extractXcmpReceive: jest.fn(),
  }
})

jest.unstable_mockModule('./ops/ump.js', () => {
  return {
    extractUmpReceive: jest.fn(),
    extractUmpSend: jest.fn(),
  }
})
*/

const SwitchboardImpl = (await import('./switchboard.js')).Switchboard

const testSub: Subscription = {
  id: '1000:2000:0',
  agent: 'xcm',
  args: {
    origin: 'urn:ocn:local:1000',
    senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
    events: '*',
    destinations: ['urn:ocn:local:2000'],
  },
  channels: [
    {
      type: 'log',
    },
  ],
}

describe('switchboard service', () => {
  let switchboard: Switchboard
  let subs: SubsStore
  let agentService: AgentService

  beforeAll(async () => {
    /*
    ;(extractXcmpSend as jest.Mock).mockImplementation(() => {
      return () => {
        return of({
          recipient: 'urn:ocn:local:2000',
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          messageData: new Uint8Array([0x00]),
          instructions: {
            bytes: '0x0300',
          },
        } as unknown as XcmSentWithContext)
      }
    })
    ;(extractXcmpReceive as jest.Mock).mockImplementation(() => {
      return () => {
        return of({
          blockNumber: {
            toString: () => 1,
          },
          blockHash: '0x0',
          messageHash: '0x0',
          outcome: 'Success',
        } as unknown as XcmInboundWithContext)
      }
    })
    ;(extractUmpSend as jest.Mock).mockImplementation(() => {
      return () =>
        of({
          recipient: 'urn:ocn:local:0',
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          messageData: new Uint8Array([0x00]),
          instructions: {
            bytes: '0x0300',
          },
        } as unknown as XcmSentWithContext)
    })
    ;(extractUmpReceive as jest.Mock).mockImplementation(() => {
      return () =>
        of({
          recipient: 'urn:ocn:local:0',
          blockNumber: {
            toString: () => 1,
          },
          blockHash: '0x0',
          messageHash: '0x0',
          outcome: 'Success',
        } as unknown as XcmInboundWithContext)
    })
    */

    subs = new SubsStore(_services.log, _services.rootStore)
    agentService = new LocalAgentService(
      {
        ..._services,
        subsStore: subs,
      } as Services,
      { mode: AgentServiceMode.local }
    )

    switchboard = new SwitchboardImpl(_services, {
      subscriptionMaxEphemeral: 10_00,
      subscriptionMaxPersistent: 10_000,
    })
    agentService.start()
  })

  afterAll(async () => {
    await _services.rootStore.clear()
    return agentService.stop()
  })

  it('should add a subscription by agent', async () => {
    await switchboard.subscribe(testSub)

    expect(switchboard.findSubscriptionHandler('xcm', testSub.id)).toBeDefined()
    expect(await subs.getById('xcm', testSub.id)).toBeDefined()
  })

  it('should remove subscription by agent', async () => {
    expect(switchboard.findSubscriptionHandler('xcm', testSub.id)).toBeDefined()
    expect(await subs.getById('xcm', testSub.id)).toBeDefined()

    await switchboard.unsubscribe('xcm', testSub.id)

    expect(() => {
      switchboard.findSubscriptionHandler('xcm', testSub.id)
    }).toThrow('subscription handler not found')
  })

  /* TODO: move to agent service test
  it('should subscribe to persisted subscriptions on start', async () => {
    await subs.insert(testSub)

    await agentService.start()

    expect(switchboard.findSubscriptionHandler('xcm', testSub.id)).toBeDefined()
  })

  it('should handle relay subscriptions', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      origin: 'urn:ocn:local:0',
    })

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should handle pipe errors', async () => {
    ;(extractUmpSend as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'))
    })
    ;(extractUmpReceive as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'))
    })
    ;(extractXcmpSend as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'))
    })
    ;(extractXcmpReceive as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'))
    })

    await switchboard.start()

    await switchboard.subscribe(testSub)

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined()

    await switchboard.stop()
  })

  it('should update destination subscriptions on destinations change', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
    })

    const { destinationSubs } = switchboard.findSubscriptionHandler(testSub.id)
    expect(destinationSubs.length).toBe(2)
    expect(destinationSubs.filter((s) => s.chainId === 'urn:ocn:local:0').length).toBe(1)
    expect(destinationSubs.filter((s) => s.chainId === 'urn:ocn:local:2000').length).toBe(1)

    // Remove 2000 and add 3000 to destinations
    const newSub = {
      ...testSub,
      destinations: ['urn:ocn:local:0', 'urn:ocn:local:3000'],
    }
    await subs.save(newSub)

    switchboard.updateSubscription(newSub)
    switchboard.updateDestinations(newSub.id)
    const { destinationSubs: newDestinationSubs } = switchboard.findSubscriptionHandler(testSub.id)
    expect(newDestinationSubs.length).toBe(2)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:0').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:3000').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:2000').length).toBe(0)
  })

  it('should create relay hrmp subscription when there is at least one HRMP pair in subscription', async () => {
    await switchboard.start()

    await switchboard.subscribe(testSub) // origin: '1000', destinations: ['2000']

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).toBeDefined()
  })

  it('should not create relay hrmp subscription when the origin is a relay chain', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      origin: 'urn:ocn:local:0', // origin: '0', destinations: ['2000']
    })

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()
  })

  it('should not create relay hrmp subscription when there are no HRMP pairs in the subscription', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      destinations: ['urn:ocn:local:0'], // origin: '1000', destinations: ['0']
    })

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()
  })

  it('should not create relay hrmp subscription when relayed events are not requested', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      events: [XcmNotificationType.Received],
    })

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()
  })

  it('should create relay hrmp subscription if relayed event is added', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      events: [XcmNotificationType.Received],
    })

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()

    // add relayed event to subscription
    const newSub = {
      ...testSub,
      events: [XcmNotificationType.Received, XcmNotificationType.Relayed],
    }
    await subs.save(newSub)

    switchboard.updateSubscription(newSub)
    switchboard.updateEvents(newSub.id)
    const { relaySub: newRelaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(newRelaySub).toBeDefined()
  })

  it('should remove relay hrmp subscription if relayed event is removed', async () => {
    await switchboard.start()

    await switchboard.subscribe({
      ...testSub,
      events: '*',
    })

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(relaySub).toBeDefined()

    // remove relayed event
    const newSub = {
      ...testSub,
      events: [XcmNotificationType.Received, XcmNotificationType.Sent],
    }
    await subs.save(newSub)

    switchboard.updateSubscription(newSub)
    switchboard.updateEvents(newSub.id)
    const { relaySub: newRelaySub } = switchboard.findSubscriptionHandler(testSub.id)
    expect(newRelaySub).not.toBeDefined()
  })

  it('should notify on matched HRMP', async () => {
    await switchboard.start()

    await switchboard.subscribe(testSub)

    await switchboard.stop()

    // we can extract the NotifierHub as a service
    // to test the matched, but not really worth right now
  })
  */
})

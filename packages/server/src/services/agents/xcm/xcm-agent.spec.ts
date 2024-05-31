import { jest } from '@jest/globals'

import { of, throwError } from 'rxjs'

import '../../../testing/network.js'

import { _services } from '../../../testing/services.js'
import { AgentServiceMode } from '../../../types.js'
import { Services } from '../../index.js'
import { SubsStore } from '../../persistence/subs.js'
import { Subscription } from '../../subscriptions/types.js'
import { LocalAgentService } from '../local.js'
import { AgentService } from '../types.js'
import * as XcmpOps from './ops/xcmp.js'
import { XCMSubscriptionHandler, XcmInboundWithContext, XcmNotificationType, XcmSentWithContext } from './types.js'
import { XcmAgent } from './xcm-agent.js'

const mockExtractXcmpReceive = jest.fn()
const mockExtractXcmpSend = jest.fn()
jest.unstable_mockModule('./ops/xcmp.js', () => {
  return {
    __esModule: true,
    ...XcmpOps,
    extractXcmpReceive: mockExtractXcmpReceive,
    extractXcmpSend: mockExtractXcmpSend,
  }
})

const mockExtractUmpReceive = jest.fn()
const mockExtractUmpSend = jest.fn()
jest.unstable_mockModule('./ops/ump.js', () => {
  return {
    extractUmpReceive: mockExtractUmpReceive,
    extractUmpSend: mockExtractUmpSend,
  }
})

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
  let subs: SubsStore
  let agentService: AgentService
  let xcmAgent: XcmAgent

  beforeEach(async () => {
    mockExtractXcmpSend.mockImplementation(() => {
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

    mockExtractXcmpReceive.mockImplementation(() => {
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
    mockExtractUmpSend.mockImplementation(() => {
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
    mockExtractUmpReceive.mockImplementation(() => {
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

    subs = new SubsStore(_services.log, _services.rootStore)
    agentService = new LocalAgentService(
      {
        ..._services,
        subsStore: subs,
      } as Services,
      { mode: AgentServiceMode.local }
    )
  })

  afterEach(async () => {
    await _services.rootStore.clear()
    return agentService.stop()
  })

  it('should subscribe to persisted subscriptions on start', async () => {
    await agentService.startAgent('xcm', [testSub])

    expect(agentService.getAgentById<XcmAgent>('xcm').getSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should handle relay subscriptions', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm')

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        origin: 'urn:ocn:local:0',
      },
    })

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should handle pipe errors', async () => {
    mockExtractUmpSend.mockImplementationOnce(() => () => {
      return throwError(() => new Error('errored'))
    })
    mockExtractUmpReceive.mockImplementationOnce(() => () => {
      return throwError(() => new Error('errored'))
    })
    mockExtractXcmpSend.mockImplementationOnce(() => () => {
      return throwError(() => new Error('errored'))
    })
    mockExtractXcmpReceive.mockImplementationOnce(() => () => {
      return throwError(() => new Error('errored'))
    })

    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent
    await xcmAgent.subscribe(testSub)

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should update destination subscriptions on destinations change', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
      },
    })

    const { destinationSubs } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(destinationSubs.length).toBe(2)
    expect(destinationSubs.filter((s) => s.chainId === 'urn:ocn:local:0').length).toBe(1)
    expect(destinationSubs.filter((s) => s.chainId === 'urn:ocn:local:2000').length).toBe(1)

    // Remove 2000 and add 3000 to destinations
    const newSub = {
      ...testSub,
      args: {
        ...testSub.args,
        destinations: ['urn:ocn:local:0', 'urn:ocn:local:3000'],
      },
    }

    await xcmAgent.update(newSub.id, [
      {
        op: 'remove',
        path: '/args/destinations/1',
      },
      {
        op: 'add',
        path: '/args/destinations/-',
        value: 'urn:ocn:local:3000',
      },
    ])
    const { destinationSubs: newDestinationSubs, descriptor } = agentService
      .getAgentById<XcmAgent>('xcm')
      .getSubscriptionHandler(testSub.id)

    expect(newDestinationSubs.length).toBe(2)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:0').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:3000').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:2000').length).toBe(0)
    expect(descriptor).toEqual(newSub)
  })

  it('should create relay hrmp subscription when there is at least one HRMP pair in subscription', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe(testSub) // origin: '1000', destinations: ['2000']

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id) as XCMSubscriptionHandler
    expect(relaySub).toBeDefined()
  })

  it('should not create relay hrmp subscription when the origin is a relay chain', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        origin: 'urn:ocn:local:0', // origin: '0', destinations: ['2000']
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id) as XCMSubscriptionHandler
    expect(relaySub).not.toBeDefined()
  })

  it('should not create relay hrmp subscription when there are no HRMP pairs in the subscription', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        destinations: ['urn:ocn:local:0'], // origin: '1000', destinations: ['0']
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()
  })

  it('should not create relay hrmp subscription when relayed events are not requested', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        events: [XcmNotificationType.Received],
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()
  })

  it('should create relay hrmp subscription if relayed event is added', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        events: [XcmNotificationType.Received],
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()

    // add relayed event to subscription
    const newSub = {
      ...testSub,
      args: {
        ...testSub.args,
        events: [XcmNotificationType.Received, XcmNotificationType.Relayed],
      },
    }

    await xcmAgent.update(newSub.id, [
      {
        op: 'add',
        path: '/args/events/-',
        value: XcmNotificationType.Relayed,
      },
    ])
    const { relaySub: newRelaySub, descriptor } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(newRelaySub).toBeDefined()
    expect(descriptor).toEqual(newSub)
  })

  it('should remove relay hrmp subscription if relayed event is removed', async () => {
    await agentService.startAgent('xcm')

    xcmAgent = agentService.getAgentById('xcm') as XcmAgent

    await xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        events: [XcmNotificationType.Received, XcmNotificationType.Sent, XcmNotificationType.Relayed],
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).toBeDefined()

    // remove relayed event
    const newSub = {
      ...testSub,
      args: {
        ...testSub.args,
        events: [XcmNotificationType.Received, XcmNotificationType.Sent],
      },
    }

    await xcmAgent.update(newSub.id, [
      {
        op: 'remove',
        path: '/args/events/2',
      },
    ])
    const { relaySub: newRelaySub, descriptor } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(newRelaySub).not.toBeDefined()
    expect(descriptor).toEqual(newSub)
  })
})

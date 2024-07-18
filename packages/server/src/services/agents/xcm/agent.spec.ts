import { jest } from '@jest/globals'

import { of, throwError } from 'rxjs'

import '@/testing/network.js'

import { _services } from '@/testing/services.js'
import { AgentServiceMode } from '@/types.js'
import { Services } from '../../index.js'
import { SubsStore } from '../../persistence/level/subs.js'
import { Subscription } from '../../subscriptions/types.js'
import { LocalAgentCatalog } from '../catalog/local.js'
import { AgentCatalog } from '../types.js'
import { XcmAgent } from './agent.js'
import * as XcmpOps from './ops/xcmp.js'
import {
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
  XcmInboundWithContext,
  XcmInputs,
  XcmNotificationType,
  XcmSentWithContext,
  XcmSubscriptionHandler,
} from './types.js'

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

const mockExtractBridgeMessageAccepted = jest.fn()
const mockExtractBridgeMessageDelivered = jest.fn()
const mockExtractBridgeReceive = jest.fn()
jest.unstable_mockModule('./ops/pk-bridge.js', () => {
  return {
    extractBridgeMessageAccepted: mockExtractBridgeMessageAccepted,
    extractBridgeMessageDelivered: mockExtractBridgeMessageDelivered,
    extractBridgeReceive: mockExtractBridgeReceive,
  }
})

const testSub: Subscription<XcmInputs> = {
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

describe('xcm agent', () => {
  let subs: SubsStore
  let agentService: AgentCatalog

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

    mockExtractBridgeMessageAccepted.mockImplementation(() => {
      return () =>
        of({
          blockNumber: 1000392,
          blockHash: '0xCAFE',
          messageHash: '0x00',
          chainId: 'urn:ocn:local1002',
          bridgeKey: '0x01',
          messageData: '0xBEEF',
          instructions: {},
          recipient: 'urn:ocn:wococo:1000',
          forwardId: '0x02',
        } as unknown as XcmBridgeAcceptedWithContext)
    })

    mockExtractBridgeMessageDelivered.mockImplementation(() => {
      return () =>
        of({
          blockNumber: 1000392,
          blockHash: '0xCAFE',
          chainId: 'urn:ocn:local1002',
          bridgeKey: '0x01',
          sender: {},
          event: {},
        } as unknown as XcmBridgeDeliveredWithContext)
    })

    mockExtractBridgeReceive.mockImplementation(() => {
      return () =>
        of({
          blockNumber: 1000392,
          blockHash: '0xCAFE',
          chainId: 'urn:ocn:local1002',
          bridgeKey: '0x01',
          outcome: 'Success',
          error: null,
          event: {},
        } as unknown as XcmBridgeInboundWithContext)
    })

    subs = new SubsStore(_services.log, _services.levelDB)
    agentService = new LocalAgentCatalog(
      {
        ..._services,
        subsStore: subs,
      } as Services,
      { mode: AgentServiceMode.local },
    )
  })

  afterEach(async () => {
    await _services.levelDB.clear()
    return agentService.stop()
  })

  it('should subscribe to persisted subscriptions on start', async () => {
    await agentService.startAgent('xcm', [testSub])

    expect(agentService.getAgentById<XcmAgent>('xcm').getSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should handle relay subscriptions', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    xcmAgent.subscribe(testSub)

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
  })

  it('should update destination subscriptions on destinations change', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    xcmAgent.update(newSub.id, [
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
    const { destinationSubs: newDestinationSubs, subscription } = agentService
      .getAgentById<XcmAgent>('xcm')
      .getSubscriptionHandler(testSub.id)

    expect(newDestinationSubs.length).toBe(2)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:0').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:3000').length).toBe(1)
    expect(newDestinationSubs.filter((s) => s.chainId === 'urn:ocn:local:2000').length).toBe(0)
    expect(subscription).toEqual(newSub)
  })

  it('should create relay hrmp subscription when there is at least one HRMP pair in subscription', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe(testSub) // origin: '1000', destinations: ['2000']

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id) as XcmSubscriptionHandler
    expect(relaySub).toBeDefined()
  })

  it('should not create relay hrmp subscription when the origin is a relay chain', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
      ...testSub,
      args: {
        ...testSub.args,
        origin: 'urn:ocn:local:0', // origin: '0', destinations: ['2000']
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id) as XcmSubscriptionHandler
    expect(relaySub).not.toBeDefined()
  })

  it('should not create relay hrmp subscription when there are no HRMP pairs in the subscription', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    xcmAgent.update(newSub.id, [
      {
        op: 'add',
        path: '/args/events/-',
        value: XcmNotificationType.Relayed,
      },
    ])
    const { relaySub: newRelaySub, subscription } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(newRelaySub).toBeDefined()
    expect(subscription).toEqual(newSub)
  })

  it('should remove relay hrmp subscription if relayed event is removed', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
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

    xcmAgent.update(newSub.id, [
      {
        op: 'remove',
        path: '/args/events/2',
      },
    ])
    const { relaySub: newRelaySub, subscription } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(newRelaySub).not.toBeDefined()
    expect(subscription).toEqual(newSub)
  })

  it('should subscribe to pk-bridge if configured', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
      id: 'test-bridge-sub',
      agent: 'xcm',
      args: {
        origin: 'urn:ocn:local:1000',
        destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000', 'urn:ocn:wococo:1000'],
        bridges: ['pk-bridge'],
      },
      channels: [
        {
          type: 'log',
        },
      ],
    })

    const { bridgeSubs } = xcmAgent.getSubscriptionHandler('test-bridge-sub')
    expect(bridgeSubs.length).toBe(1)
  })
})

import { jest } from '@jest/globals'

import { from, throwError } from 'rxjs'

import '@/testing/network.js'

import { _ingress, _services } from '@/testing/services.js'
import { AgentServiceMode } from '@/types.js'
import { NetworkURN, Services } from '../../index.js'
import { SubsStore } from '../../persistence/level/subs.js'
import { Subscription } from '../../subscriptions/types.js'
import { SharedStreams } from '../base/shared.js'
import { LocalAgentCatalog } from '../catalog/local.js'
import { AgentCatalog } from '../types.js'
import { XcmAgent } from './agent.js'

import { ValidationError } from '@/errors.js'
import { polkadotBlocks } from '@/testing/blocks.js'
import { extractEvents } from '@sodazone/ocelloids-sdk'
import { XcmSubscriptionManager } from './handlers.js'
import { XcmInputs, XcmNotificationType, XcmSubscriptionHandler } from './types.js'

const testSub: Subscription<XcmInputs> = {
  id: '1000:2000:0',
  agent: 'xcm',
  owner: 'unknown',
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

  it('should throw when subscribing to a chain that is not configured', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    const chainId = 'urn:ocn:local:6001'

    expect(() => {
      xcmAgent.subscribe({
        ...testSub,
        args: {
          ...testSub.args,
          origin: chainId,
        },
      })
    }).toThrow(new ValidationError('Invalid chain id:' + chainId))
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

  it('should handle pipe errors in outbound subscriptions', async () => {
    jest
      .spyOn(SharedStreams.prototype, 'blockEvents')
      .mockImplementationOnce((_chainId: NetworkURN) => from(polkadotBlocks).pipe(extractEvents()))
    jest.spyOn(_ingress, 'getRegistry').mockImplementationOnce(() => throwError(() => new Error('errored')))
    const spy = jest.spyOn(XcmSubscriptionManager.prototype, 'tryRecoverOutbound')

    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    xcmAgent.subscribe(testSub)

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
    expect(spy).toHaveBeenCalled()
  })

  it('should handle pipe errors in relay subscriptions', async () => {
    jest
      .spyOn(SharedStreams.prototype, 'blockExtrinsics')
      .mockImplementationOnce((_chainId: NetworkURN) => throwError(() => new Error('errored')))
    const spy = jest.spyOn(XcmSubscriptionManager.prototype, 'tryRecoverRelay')

    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    xcmAgent.subscribe(testSub)

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
    expect(spy).toHaveBeenCalled()
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
    expect(relaySub).toBeUndefined()
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
    expect(relaySub).toBeUndefined()
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
    expect(relaySub).toBeUndefined()
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
    expect(newRelaySub).toBeUndefined()
    expect(subscription).toEqual(newSub)
  })

  it('should subscribe to pk-bridge if configured', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')

    xcmAgent.subscribe({
      id: 'test-bridge-sub',
      agent: 'xcm',
      owner: 'unknown',
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

  it('should throw on bridge subscription without destination on different consensus', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    const id = 'test-bridge-sub'

    expect(() => {
      xcmAgent.subscribe({
        id,
        agent: 'xcm',
        owner: 'unknown',
        args: {
          origin: 'urn:ocn:local:1000',
          destinations: ['urn:ocn:local:0'],
          bridges: ['pk-bridge'],
        },
        channels: [
          {
            type: 'log',
          },
        ],
      })
    }).toThrow(`No destination on different consensus found for bridging (sub=${id})`)
    expect(xcmAgent.getSubscriptionHandler('test-bridge-sub')).toBeUndefined()
  })

  it('should throw on bridge subscription if no bridge hub id configured', async () => {
    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    const id = 'test-bridge-sub'
    const origin = 'urn:ocn:local:1000'
    const destinations = ['urn:ocn:local:0', 'urn:ocn:paseo:0']

    expect(() => {
      xcmAgent.subscribe({
        id,
        agent: 'xcm',
        owner: 'unknown',
        args: {
          origin,
          destinations,
          bridges: ['pk-bridge'],
        },
        channels: [
          {
            type: 'log',
          },
        ],
      })
    }).toThrow(
      `Unable to subscribe to PK bridge due to missing bridge hub network URNs for origin=${origin} and destinations=${destinations}. (sub=${id})`,
    )
    expect(xcmAgent.getSubscriptionHandler('test-bridge-sub')).toBeUndefined()
  })
})

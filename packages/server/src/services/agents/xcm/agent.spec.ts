import { from, throwError } from 'rxjs'

import { polkadotBlocks } from '@/testing/blocks.js'

import '@/testing/network.js'

import { extractEvents } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { createServices } from '@/testing/services.js'

import { IngressConsumer } from '@/services/ingress/index.js'
import { NetworkURN } from '../../index.js'
import { Subscription } from '../../subscriptions/types.js'
import { SharedStreams } from '../base/shared.js'
import { AgentCatalog } from '../types.js'
import { XcmAgent } from './agent.js'
import { XcmSubscriptionManager } from './handlers.js'
import { XcmInputs, XcmSubscriptionHandler } from './types.js'

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
  let agentService: AgentCatalog
  let ingress: IngressConsumer

  beforeEach(async () => {
    const services = createServices()
    services.levelDB.setMaxListeners(20)
    ingress = services.ingress
    agentService = services.agentCatalog
  })

  afterEach(async () => {
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
    vi.spyOn(SharedStreams.prototype, 'blockEvents').mockImplementationOnce((_chainId: NetworkURN) =>
      from(polkadotBlocks).pipe(extractEvents()),
    )
    vi.spyOn(ingress, 'getContext').mockImplementationOnce(() => throwError(() => new Error('errored')))
    const spy = vi.spyOn(XcmSubscriptionManager.prototype, 'tryRecoverOutbound')

    await agentService.startAgent('xcm')

    const xcmAgent = agentService.getAgentById<XcmAgent>('xcm')
    xcmAgent.subscribe(testSub)

    expect(xcmAgent.getSubscriptionHandler(testSub.id)).toBeDefined()
    expect(spy).toHaveBeenCalled()
  })

  it('should handle pipe errors in relay subscriptions', async () => {
    vi.spyOn(SharedStreams.prototype, 'blockExtrinsics').mockImplementationOnce((_chainId: NetworkURN) =>
      throwError(() => new Error('errored')),
    )
    const spy = vi.spyOn(XcmSubscriptionManager.prototype, 'tryRecoverRelay')

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
        events: ['xcm.received'],
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
        events: ['xcm.received'],
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).not.toBeDefined()

    // add relayed event to subscription
    const newSub = {
      ...testSub,
      args: {
        ...testSub.args,
        events: ['xcm.received', 'xcm.relayed'],
      },
    }

    xcmAgent.update(newSub.id, [
      {
        op: 'add',
        path: '/args/events/-',
        value: 'xcm.relayed',
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
        events: ['xcm.received', 'xcm.sent', 'xcm.relayed'],
      },
    })

    const { relaySub } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(relaySub).toBeDefined()

    // remove relayed event
    const newSub = {
      ...testSub,
      args: {
        ...testSub.args,
        events: ['xcm.received', 'xcm.sent'],
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
})

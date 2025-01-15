import '@/testing/network.js'

import { ValidationError } from '@/errors.js'
import { createServices } from '@/testing/services.js'

import { Subscription } from '../../subscriptions/types.js'
import { AgentCatalog } from '../types.js'
import { XcmAgent } from './agent.js'
import { XcmInputs } from './types.js'

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

  beforeEach(async () => {
    const services = createServices()
    services.levelDB.setMaxListeners(20)
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

    const { destinationsControl } = xcmAgent.getSubscriptionHandler(testSub.id)
    expect(destinationsControl.value.test({ chainId: 'urn:ocn:local:2000' })).toBeTruthy()

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
    const { destinationsControl: newDestinationsControl, subscription } = agentService
      .getAgentById<XcmAgent>('xcm')
      .getSubscriptionHandler(testSub.id)

    expect(subscription).toEqual(newSub)
    expect(newDestinationsControl.value.test({ chainId: 'urn:ocn:local:3000' })).toBeTruthy()
    expect(newDestinationsControl.value.test({ chainId: 'urn:ocn:local:2000' })).toBeFalsy()
  })
})

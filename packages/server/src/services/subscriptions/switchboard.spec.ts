import '../../testing/network.js'

import { _services } from '../../testing/services.js'
import { AgentServiceMode } from '../../types.js'
import { LocalAgentService } from '../agents/local.js'
import { AgentService } from '../agents/types.js'
import { SubsStore } from '../persistence/subs'
import { Services } from '../types.js'
import type { Switchboard } from './switchboard.js'
import { Subscription } from './types'

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
    }).toThrow('subscription not found')
  })
})

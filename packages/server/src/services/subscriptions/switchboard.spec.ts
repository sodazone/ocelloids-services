import '@/testing/network.js'

import { SubsStore } from '@/services/persistence/level/subs.js'
import { createServices } from '@/testing/services.js'

import { Services } from '../types.js'
import type { Switchboard } from './switchboard.js'
import { Subscription } from './types.js'

const SwitchboardImpl = (await import('./switchboard.js')).Switchboard

const testSub: Subscription = {
  id: '1000:2000:0',
  agent: 'xcm',
  owner: 'unknown',
  args: {
    origins: ['urn:ocn:local:1000'],
    destinations: ['urn:ocn:local:2000'],
    senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
    events: '*',
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
  let services: Services

  beforeAll(async () => {
    services = createServices()
    subs = new SubsStore(services.log, services.levelDB)
    switchboard = new SwitchboardImpl(services, {
      subscriptionMaxEphemeral: 10_00,
      subscriptionMaxPersistent: 10_000,
    })
  })

  afterAll(async () => {
    await services.levelDB.clear()
  })

  it('should add a subscription by agent', async () => {
    await switchboard.subscribe(testSub)

    expect(await switchboard.findSubscription('xcm', testSub.id)).toBeDefined()
    expect(await subs.getById('xcm', testSub.id)).toBeDefined()
  })

  it('should remove subscription by agent', async () => {
    expect(switchboard.findSubscription('xcm', testSub.id)).toBeDefined()
    expect(await subs.getById('xcm', testSub.id)).toBeDefined()

    await switchboard.unsubscribe('xcm', testSub.id)

    await expect(async () => {
      await switchboard.findSubscription('xcm', testSub.id)
    }).rejects.toThrow('Subscription xcm 1000:2000:0 not found.')
  })
})

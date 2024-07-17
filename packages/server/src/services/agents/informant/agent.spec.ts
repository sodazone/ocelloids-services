import { jest } from '@jest/globals'
import { from } from 'rxjs'

import { extractEvents, extractTxWithEvents } from '@sodazone/ocelloids-sdk'

import { Egress } from '@/services/egress/hub.js'
import { SubsStore } from '@/services/persistence/level/subs.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'
import { _services } from '@/testing/services.js'
import { AgentServiceMode } from '@/types.js'
import { SharedStreams } from '../base/shared.js'
import { LocalAgentCatalog } from '../catalog/local.js'
import { AgentCatalog } from '../types.js'
import { InformantAgent, InformantInputs } from './agent.js'

import '@/testing/network.js'
import { polkadotBlocks } from '@/testing/blocks.js'

jest.spyOn(SharedStreams.prototype, 'blockEvents').mockImplementation((_chainId: NetworkURN) => {
  return from(polkadotBlocks).pipe(extractEvents())
})

jest.spyOn(SharedStreams.prototype, 'blockExtrinsics').mockImplementation((_chainId: NetworkURN) => {
  return from(polkadotBlocks).pipe(extractTxWithEvents())
})

const eventSub: Subscription<InformantInputs> = {
  id: 'test-event-sub',
  agent: 'informant',
  args: {
    networks: ['urn:ocn:polkadot:0'],
    // Set the filter criteria for the events
    filter: {
      type: 'event',
      match: {
        section: 'balances',
        $or: [{ method: 'Deposit' }, { method: 'Transfer' }],
      },
    },
  },
  channels: [
    {
      type: 'log',
    },
  ],
}

const extrinsicSub: Subscription<InformantInputs> = {
  id: 'test-extrinsic-sub',
  agent: 'informant',
  args: {
    networks: ['urn:ocn:polkadot:0'],
    filter: {
      type: 'extrinsic',
      match: {
        'extrinsic.call.section': 'balances',
        'extrinsic.call.method': { $in: ['transferAllowDeath', 'transferKeepAlive'] },
      },
    },
  },
  channels: [
    {
      type: 'log',
    },
  ],
}

describe('informant agent', () => {
  let subs: SubsStore
  let agentService: AgentCatalog

  beforeEach(() => {
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
    await agentService.startAgent('informant', [eventSub, extrinsicSub])
    const agent = agentService.getAgentById<InformantAgent>('informant')

    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
    expect(agent.getSubscriptionHandler(extrinsicSub.id)).toBeDefined()
  })

  it('should subscribe to event subscriptions', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    await agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
  })

  it('should subscribe to extrinsic subscriptions', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    await agent.subscribe(extrinsicSub)
    expect(agent.getSubscriptionHandler(extrinsicSub.id)).toBeDefined()
  })

  it('should fail on invalid mongo filter inputs', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')

    await expect(
      agent.subscribe({
        ...extrinsicSub,
        args: {
          ...extrinsicSub.args,
          filter: {
            ...extrinsicSub.args.filter,
            match: {
              section: 'balances',
              $foo: 'bar',
            },
          },
        },
      }),
    ).rejects.toThrow()
  })

  it('should publish to egress for event subscriptions', async () => {
    const spy = jest.spyOn(Egress.prototype, 'publish')

    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    await agent.subscribe(eventSub)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('should unsubscribe subscription', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    await agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
    await agent.unsubscribe(eventSub.id)
    expect(agent.getSubscriptionHandler(eventSub.id)).not.toBeDefined()
  })

  it('should update subscription', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    await agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()

    const newSub = await agent.update(eventSub.id, [
      { op: 'add', path: '/args/networks/-', value: 'urn:ocn:polkadot:1000' },
      { op: 'replace', path: '/args/filter/match/section', value: 'accounts' },
    ])

    expect(newSub.args).toEqual({
      networks: ['urn:ocn:polkadot:0', 'urn:ocn:polkadot:1000'],
      filter: {
        type: 'event',
        match: {
          section: 'accounts',
          $or: [{ method: 'Deposit' }, { method: 'Transfer' }],
        },
      },
    })
  })
})

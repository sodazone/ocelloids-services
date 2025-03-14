import { from } from 'rxjs'

import { Egress } from '@/services/egress/hub.js'
import { SubsStore } from '@/services/persistence/level/subs.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'
import { polkadotBlocks } from '@/testing/blocks.js'
import { createServices } from '@/testing/services.js'
import { AgentServiceMode } from '@/types.js'
import { SubstrateSharedStreams } from '../../networking/substrate/shared.js'
import { LocalAgentCatalog } from '../catalog/local.js'
import { AgentCatalog } from '../types.js'
import { InformantAgent, InformantInputs } from './agent.js'

import '@/testing/network.js'
import { extractEvents, extractTxWithEvents } from '@/services/networking/substrate/index.js'

vi.spyOn(SubstrateSharedStreams.prototype, 'blockEvents').mockImplementation((_chainId: NetworkURN) => {
  return from(polkadotBlocks).pipe(extractEvents())
})

vi.spyOn(SubstrateSharedStreams.prototype, 'blockExtrinsics').mockImplementation((_chainId: NetworkURN) => {
  return from(polkadotBlocks).pipe(extractTxWithEvents())
})

const eventSub: Subscription<InformantInputs> = {
  id: 'test-event-sub',
  agent: 'informant',
  owner: 'test-account',
  args: {
    networks: ['urn:ocn:local:0'],
    // Set the filter criteria for the events
    filter: {
      type: 'event',
      match: {
        module: 'Balances',
        $or: [{ name: 'Deposit' }, { name: 'Transfer' }],
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
  owner: 'test-account',
  args: {
    networks: ['urn:ocn:local:0'],
    filter: {
      type: 'extrinsic',
      match: {
        module: 'Balances',
        method: 'transfer_allow_death',
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
  let egress: Egress
  let services: Services

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(async () => {
    subs = new SubsStore(services.log, services.levelDB)
    egress = new Egress(services)
    agentService = new LocalAgentCatalog(
      {
        ...services,
        subsStore: subs,
        egress,
      } as Services,
      { agentServiceMode: AgentServiceMode.local, agents: '*' },
    )
  })

  afterEach(async () => {
    await services.levelDB.clear()
    return agentService.stop()
  })

  it('should subscribe to persisted subscriptions on start', async () => {
    await agentService.startAgent('informant', [eventSub, extrinsicSub])
    const agent = agentService.getAgentById<InformantAgent>('informant')

    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
    expect(agent.getSubscriptionHandler(extrinsicSub.id)).toBeDefined()
  })

  it('should throw error on unsupported network', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    expect(() =>
      agent.subscribe({
        ...eventSub,
        args: {
          ...eventSub.args,
          networks: ['urn:ocn:unsupported:0'],
        },
      }),
    ).toThrow()
  })

  it('should subscribe to event subscriptions', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
  })

  it('should subscribe to extrinsic subscriptions', async () => {
    const spy = vi.spyOn(egress, 'publish')
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    agent.subscribe(extrinsicSub)
    expect(agent.getSubscriptionHandler(extrinsicSub.id)).toBeDefined()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should fail on invalid mongo filter inputs', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')

    expect(() => {
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
      })
    }).toThrow()
  })

  it('should publish to egress for event subscriptions', async () => {
    const spy = vi.spyOn(egress, 'publish')

    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    agent.subscribe(eventSub)
    expect(spy).toHaveBeenCalledTimes(16)
  })

  it('should unsubscribe subscription', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()
    agent.unsubscribe(eventSub.id)
    expect(agent.getSubscriptionHandler(eventSub.id)).not.toBeDefined()
  })

  it('should update subscription', async () => {
    await agentService.startAgent('informant')
    const agent = agentService.getAgentById<InformantAgent>('informant')
    agent.subscribe(eventSub)
    expect(agent.getSubscriptionHandler(eventSub.id)).toBeDefined()

    const newSub = agent.update(eventSub.id, [
      { op: 'add', path: '/args/networks/-', value: 'urn:ocn:local:1000' },
      { op: 'replace', path: '/args/filter/match/section', value: 'accounts' },
    ])

    expect(newSub.args).toEqual({
      networks: ['urn:ocn:local:0', 'urn:ocn:local:1000'],
      filter: {
        type: 'event',
        match: {
          module: 'Balances',
          $or: [{ name: 'Deposit' }, { name: 'Transfer' }],
        },
      },
    })
  })
})

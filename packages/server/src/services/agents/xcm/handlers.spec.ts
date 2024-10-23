import { FastifyBaseLogger } from 'fastify'
import { Subscription as RxSubscription } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { Services } from '@/services/types.js'
import { createServices } from '@/testing/services.js'

import { XcmAgent } from './agent.js'
import { XcmSubscriptionManager } from './handlers.js'
import { messageCriteria, sendersCriteria } from './ops/criteria.js'
import { XcmInputs, XcmSubscriptionHandler } from './types.js'

vi.useFakeTimers()

const origin = 'urn:ocn:local:1000'
const destinations = ['urn:ocn:local:2000']

const testSub: Subscription<XcmInputs> = {
  id: '1000:2000:0',
  agent: 'xcm',
  owner: 'unknown',
  args: {
    origin,
    senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
    events: '*',
    destinations,
  },
  channels: [
    {
      type: 'log',
    },
  ],
}

const mockOriginSubscription = {
  unsubscribe: vi.fn(),
} as unknown as RxSubscription

const mockDestSubscription = {
  unsubscribe: vi.fn(),
} as unknown as RxSubscription

const mockRelaySubscription = {
  unsubscribe: vi.fn(),
} as unknown as RxSubscription

const testXcmSubscriptionHandler: XcmSubscriptionHandler = {
  originSubs: [
    {
      chainId: 'urn:ocn:local:1000',
      sub: mockOriginSubscription,
    },
  ],
  destinationSubs: [
    {
      chainId: 'urn:ocn:local:2000',
      sub: mockDestSubscription,
    },
  ],
  bridgeSubs: [],
  sendersControl: new ControlQuery(sendersCriteria(['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'])),
  messageControl: new ControlQuery(
    messageCriteria(['urn:ocn:local:0', 'urn:ocn:local:1000', 'urn:ocn:local:2000']),
  ),
  subscription: testSub,
  relaySub: {
    chainId: 'urn:ocn:local:0',
    sub: mockRelaySubscription,
  },
}

describe('XcmSubscriptionManager', () => {
  let mockLogger
  let xcmAgent: XcmAgent
  let xcmSubscriptionManager: XcmSubscriptionManager
  let services: Services

  beforeEach(() => {
    vi.clearAllTimers()
  })

  beforeAll(() => {
    services = createServices()
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as FastifyBaseLogger
    xcmAgent = new XcmAgent({ ...services, db: services.levelDB })
    xcmSubscriptionManager = new XcmSubscriptionManager(mockLogger, services.ingress, xcmAgent)
    xcmSubscriptionManager.set(testSub.id, testXcmSubscriptionHandler)
  })

  afterAll(async () => {
    await services.levelDB.clear()
    await xcmAgent.stop()
  })

  describe('hasSubscriptionForBridge', () => {
    it('should return false if there are no pk-bridge bridge subscriptions', () => {
      expect(xcmSubscriptionManager.hasSubscriptionForBridge(testSub.id, 'pk-bridge')).toBeFalsy()
    })
  })

  describe('hasSubscriptionForDestination', () => {
    it('should return true for a destination chain', () => {
      expect(
        xcmSubscriptionManager.hasSubscriptionForDestination(testSub.id, 'urn:ocn:local:2000'),
      ).toBeTruthy()
    })

    it('should return false for non-destination chains', () => {
      expect(
        xcmSubscriptionManager.hasSubscriptionForDestination(testSub.id, 'urn:ocn:local:3000'),
      ).toBeFalsy()
      expect(
        xcmSubscriptionManager.hasSubscriptionForDestination(testSub.id, 'urn:ocn:local:1000'),
      ).toBeFalsy()
      expect(xcmSubscriptionManager.hasSubscriptionForDestination(testSub.id, 'urn:ocn:local:0')).toBeFalsy()
    })
  })

  describe('hasSubscriptionForOrigin', () => {
    it('should return true for an origin chain', () => {
      expect(xcmSubscriptionManager.hasSubscriptionForOrigin(testSub.id, 'urn:ocn:local:1000')).toBeTruthy()
    })

    it('should return false for non-origin chains', () => {
      expect(xcmSubscriptionManager.hasSubscriptionForOrigin(testSub.id, 'urn:ocn:local:3000')).toBeFalsy()
      expect(xcmSubscriptionManager.hasSubscriptionForOrigin(testSub.id, 'urn:ocn:local:2000')).toBeFalsy()
      expect(xcmSubscriptionManager.hasSubscriptionForOrigin(testSub.id, 'urn:ocn:local:0')).toBeFalsy()
    })
  })

  describe('hasSubscriptionForRelay', () => {
    it('should return true for a parachain-to-parachain subscription', () => {
      expect(xcmSubscriptionManager.hasSubscriptionForRelay(testSub.id)).toBeTruthy()
    })
  })

  describe('tryRecoverRelay', () => {
    it('should unsubscribe from errored relay subscription and add new subscription', () => {
      const monitorRelaySpy = vi.spyOn(xcmAgent, '__monitorRelay')

      xcmSubscriptionManager.tryRecoverRelay(new Error('test error'), testSub.id, origin)

      vi.advanceTimersToNextTimer()

      expect(mockRelaySubscription.unsubscribe).toHaveBeenCalled()
      expect(monitorRelaySpy).toHaveBeenCalled()
      expect(xcmSubscriptionManager.hasSubscriptionForRelay(testSub.id)).toBeTruthy()
    })
  })

  describe('tryRecoverInbound', () => {
    it('should unsubscribe from errored inbound subscription and add new subscription', () => {
      const monitorDestinationsSpy = vi.spyOn(xcmAgent, '__monitorDestinations')

      xcmSubscriptionManager.tryRecoverInbound(new Error('test error'), testSub.id, destinations[0])

      vi.advanceTimersToNextTimer()

      expect(mockDestSubscription.unsubscribe).toHaveBeenCalled()
      expect(monitorDestinationsSpy).toHaveBeenCalled()
      expect(xcmSubscriptionManager.hasSubscriptionForDestination(testSub.id, destinations[0])).toBeTruthy()
    })
  })

  describe('tryRecoverOutbound', () => {
    it('should unsubscribe from errored outbound subscription and add new subscription', () => {
      const monitorOriginSpy = vi.spyOn(xcmAgent, '__monitorOrigins')

      xcmSubscriptionManager.tryRecoverOutbound(new Error('test error'), testSub.id, origin)

      vi.advanceTimersToNextTimer()

      expect(mockOriginSubscription.unsubscribe).toHaveBeenCalled()
      expect(monitorOriginSpy).toHaveBeenCalled()
      expect(xcmSubscriptionManager.hasSubscriptionForOrigin(testSub.id, origin)).toBeTruthy()
    })
  })
})

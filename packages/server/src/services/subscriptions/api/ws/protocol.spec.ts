import { jest } from '@jest/globals'

import { EventEmitter } from 'events'
import { Switchboard } from '@/services/subscriptions/switchboard.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { FastifyBaseLogger, FastifyRequest } from 'fastify'
import WebsocketProtocol from './protocol.js'

const flushPromises = () => new Promise((resolve) => jest.requireActual<any>('timers').setImmediate(resolve))

const testSub: Subscription = {
  id: 'test-subscription',
  agent: 'xcm',
  owner: 'test-account',
  args: {
    origin: '1000',
    senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
    destinations: ['2000'],
  },
  channels: [
    {
      type: 'websocket',
    },
  ],
}

const mockRequest = {
  id: 'mockRequestId',
  ip: 'mockRequestIp',
  server: {},
} as FastifyRequest

describe('WebsocketProtocol', () => {
  let mockLogger
  let mockSwitchboard: Switchboard
  let mockOptions
  let websocketProtocol: WebsocketProtocol

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    } as unknown as FastifyBaseLogger
    mockSwitchboard = {
      addEgressListener: jest.fn(),
      removeEgressListener: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      findSubscription: jest.fn(),
    } as unknown as Switchboard
    mockOptions = {
      wsMaxClients: 2,
    }
    websocketProtocol = new WebsocketProtocol(mockLogger, mockSwitchboard, mockOptions)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize properties correctly', () => {
      expect(websocketProtocol).toBeInstanceOf(EventEmitter)
      expect(mockSwitchboard.addEgressListener).toHaveBeenCalledWith('websocket', expect.any(Function))
    })
  })

  describe('stop', () => {
    it('should remove egress listener', () => {
      websocketProtocol.stop()
      expect(mockSwitchboard.removeEgressListener).toHaveBeenCalledWith('websocket', expect.any(Function))
    })
  })

  describe('handle', () => {
    it('should handle on-demand ephemeral subscriptions', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub))
      const mockStream = {
        close: jest.fn(),
        once: jest.fn(),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        write: jest.fn(),
      } as any

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()
      expect(mockSwitchboard.subscribe).toHaveBeenCalledTimes(1)
    })

    it('should send error if subscription is not valid JSON', async () => {
      const mockData = Buffer.from('macario')
      const mockStream = {
        close: jest.fn(),
        once: jest.fn(),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        write: jest.fn(),
        send: jest.fn(),
      } as any

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()
      expect(mockSwitchboard.subscribe).toHaveBeenCalledTimes(0)
      expect(mockStream.send).toHaveBeenCalledWith(
        '{"issues":[{"code":"custom","message":"Invalid JSON","path":[]}],"name":"ZodError"}',
        expect.any(Function),
      )
    })

    it('should perform authentication if configured', async () => {
      const mockVerify = jest.fn()
      const mockRequestWithAuth = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
        server: {
          authEnabled: true,
          jwt: {
            verify: mockVerify,
          },
          log: {
            error: jest.fn(),
          },
        },
      } as unknown as FastifyRequest
      const mockData = Buffer.from(JSON.stringify(testSub))
      const mockStream = {
        close: jest.fn(),
        once: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        write: jest.fn(),
        send: jest.fn(),
      } as any

      websocketProtocol.handle(mockStream, mockRequestWithAuth)
      await new Promise(setImmediate)
      await flushPromises()

      expect(mockSwitchboard.subscribe).toHaveBeenCalledTimes(0)
      expect(mockVerify).toHaveBeenCalledTimes(1)
    })

    it('should close connection if number of connections exceed maxClients', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub))
      const mockStream = {
        close: jest.fn(),
        once: jest.fn(),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        write: jest.fn(),
      } as any

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()
      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()
      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()

      expect(mockStream.close).toHaveBeenCalledWith(1013, 'server too busy')
    })

    it('should close connection with error if websocket channel not enabled in subscription', async () => {
      const mockData = Buffer.from(
        JSON.stringify({
          ...testSub,
          channels: [{ type: 'log' }],
        }),
      )
      const mockStream = {
        close: jest.fn(),
        once: jest.fn(),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        send: jest.fn(),
      } as any
      ;(mockSwitchboard.findSubscription as jest.Mock).mockImplementationOnce(() => ({
        ...testSub,
        channels: [{ type: 'log' }],
      }))

      await websocketProtocol.handle(mockStream, mockRequest, {
        subscriptionId: 'test-subscription',
        agentId: 'xcm',
      })
      await flushPromises()

      expect(mockStream.close).toHaveBeenCalledWith(1007, 'inconsistent payload')
    })

    it('should close connection with error code if unable to add subscription', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub))
      const mockStream = {
        close: jest.fn(),
        once: jest.fn(),
        on: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(mockData)
        }),
        send: jest.fn(),
      } as any

      const mockError = new Error('Test error')
      ;(mockSwitchboard.subscribe as jest.Mock).mockImplementationOnce(() => {
        throw mockError
      })

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()

      expect(mockStream.close).toHaveBeenCalledWith(1011, 'server error')
    })

    it('should close connection with error code if an error occurs', async () => {
      const mockStream = { close: jest.fn() } as any
      ;(mockSwitchboard.findSubscription as jest.Mock).mockImplementationOnce(() => {
        throw new Error('subscription not found')
      })
      await websocketProtocol.handle(mockStream, mockRequest, { subscriptionId: 'testId', agentId: 'xcm' })
      expect(mockStream.close).toHaveBeenCalledWith(1007, 'inconsistent payload')
    })
  })
})

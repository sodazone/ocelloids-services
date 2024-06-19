import { jest } from '@jest/globals'

import { EventEmitter } from 'events'
import { FastifyRequest } from 'fastify'
import { Switchboard } from '../../switchboard'
import { Subscription } from '../../types'
import WebsocketProtocol from './protocol'

const flushPromises = () => new Promise((resolve) => jest.requireActual<any>('timers').setImmediate(resolve))

const testSub: Subscription = {
  id: 'test-subscription',
  agent: 'xcm',
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
  let websocketProtocol

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    }
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
      }

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()
      expect(mockSwitchboard.subscribe).toHaveBeenCalledTimes(1)
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
      }

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
      }
      ;(mockSwitchboard.findSubscription as jest.Mock).mockImplementationOnce(() => ({
        ...testSub,
        channels: [{ type: 'log' }],
      }))

      await websocketProtocol.handle(mockStream, mockRequest, 'test-subscription')
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
      }

      const mockError = new Error('Test error')
      ;(mockSwitchboard.subscribe as jest.Mock).mockImplementationOnce(() => {
        throw mockError
      })

      await websocketProtocol.handle(mockStream, mockRequest)
      await flushPromises()

      expect(mockStream.close).toHaveBeenCalledWith(1011, 'server error')
    })

    it('should close connection with error code if an error occurs', async () => {
      const mockStream = { close: jest.fn() }
      ;(mockSwitchboard.findSubscription as jest.Mock).mockImplementationOnce(() => {
        throw new Error('subscription not found')
      })
      await websocketProtocol.handle(mockStream, mockRequest, 'testId')
      expect(mockStream.close).toHaveBeenCalledWith(1007, 'inconsistent payload')
    })
  })
})

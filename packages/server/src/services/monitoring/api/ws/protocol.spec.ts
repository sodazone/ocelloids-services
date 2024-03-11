import { jest } from '@jest/globals';

import { EventEmitter } from 'events';
import { FastifyRequest } from 'fastify';
import WebsocketProtocol from './protocol';
import { Subscription } from '../../types';

const flushPromises = () => new Promise((resolve) => jest.requireActual<any>('timers').setImmediate(resolve));

const testSub: Subscription = {
  id: 'test-subscription',
  origin: '1000',
  senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
  destinations: ['2000'],
  channels: [
    {
      type: 'websocket',
    },
  ],
  events: '*',
};

describe('WebsocketProtocol', () => {
  let mockLogger;
  let mockSwitchboard;
  let mockOptions;
  let websocketProtocol;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    };
    mockSwitchboard = {
      addNotificationListener: jest.fn(),
      removeNotificationListener: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      findSubscriptionHandler: jest.fn(),
    };
    mockOptions = {
      wsMaxClients: 2,
    };
    websocketProtocol = new WebsocketProtocol(mockLogger, mockSwitchboard, mockOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize properties correctly', () => {
      expect(websocketProtocol).toBeInstanceOf(EventEmitter);
      expect(mockSwitchboard.addNotificationListener).toHaveBeenCalledWith('websocket', expect.any(Function));
    });
  });

  describe('stop', () => {
    it('should remove notification listener', () => {
      websocketProtocol.stop();
      expect(mockSwitchboard.removeNotificationListener).toHaveBeenCalledWith('websocket', expect.any(Function));
    });
  });

  describe('handle', () => {
    it('should handle on-demand ephemeral subscriptions', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub));
      const mockStream = {
        socket: { close: jest.fn(), once: jest.fn() },
        writable: true,
        on: jest.fn((_: string, fn: (data: Buffer) => void) => { fn(mockData) }),
        write: jest.fn()
      };
      const mockRequest = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
      } as FastifyRequest;

      await websocketProtocol.handle(mockStream, mockRequest);
      await flushPromises();
      expect(mockSwitchboard.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should close connection if number of connections exceed maxClients', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub));
      const mockStream = {
        socket: { close: jest.fn(), once: jest.fn() },
        writable: true,
        on: jest.fn((_: string, fn: (data: Buffer) => void) => { fn(mockData) }),
        write: jest.fn()
      };
      const mockRequest = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
      } as FastifyRequest;

      await websocketProtocol.handle(mockStream, mockRequest);
      await flushPromises();
      await websocketProtocol.handle(mockStream, mockRequest);
      await flushPromises();
      await websocketProtocol.handle(mockStream, mockRequest);
      await flushPromises();

      expect(mockStream.socket.close).toHaveBeenCalledWith(1013, 'server too busy');
    });

    it('should close connection with error if websocket channel not enabled in subscription', async () => {
      const mockData = Buffer.from(
        JSON.stringify({
          ...testSub,
          channels: [{ type: 'log' }]
        })
      );
      const mockStream = {
        socket: { close: jest.fn(), once: jest.fn() },
        writable: true,
        on: jest.fn((_: string, fn: (data: Buffer) => void) => { fn(mockData) }),
        write: jest.fn()
      };
      const mockRequest = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
      } as FastifyRequest;
      mockSwitchboard.findSubscriptionHandler
        .mockImplementationOnce(
          () => ({
            descriptor: {
              ...testSub,
              channels: [{ type: 'log' }]
            }
          })
        );
      
      await websocketProtocol.handle(mockStream, mockRequest, 'test-subscription');
      await flushPromises();

      expect(mockStream.socket.close).toHaveBeenCalledWith(1007, 'websocket channel not enabled in subscription');
    });

    it('should close connection with error code if unable to add subscription', async () => {
      const mockData = Buffer.from(JSON.stringify(testSub));
      const mockStream = {
        socket: { close: jest.fn(), once: jest.fn() },
        writable: true,
        on: jest.fn((_: string, fn: (data: Buffer) => void) => { fn(mockData) }),
        write: jest.fn()
      };
      const mockRequest = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
      } as FastifyRequest;
      const mockError = new Error('Test error');

      mockSwitchboard.subscribe.mockImplementationOnce(() => { throw mockError; });
      
      await websocketProtocol.handle(mockStream, mockRequest);
      await flushPromises();

      expect(mockStream.socket.close).toHaveBeenCalledWith(1013, 'server too busy');
    });

    it('should close connection with error code if an error occurs', async () => {
      const mockStream = { socket: { close: jest.fn() }, writable: true };
      mockSwitchboard.findSubscriptionHandler.mockImplementationOnce(() => { return undefined; });
      await websocketProtocol.handle(mockStream, {} as FastifyRequest, 'testId');
      expect(mockStream.socket.close).toHaveBeenCalledWith(1007, 'subscription not found');
    });
  });
});

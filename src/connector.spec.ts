import fs from 'node:fs';
// import { log } from 'console';

import { ServiceContext } from './context.js';
import Connector from './connector.js';
import { mockConfigLC, mockConfigMixed, mockConfigRelayLast, mockConfigWS, mockLog } from './_mocks/context.js';

jest.mock('@substrate/connect');
jest.mock('fs', () => {
  const original = jest.requireActual('node:fs');
  return {
    ...original,
    readFileSync: jest.fn()
  };
});
jest.mock('@polkadot/api', () => {
  const original = jest.requireActual('@polkadot/api');

  return {
    ...original,
    WsProvider: jest.fn(() => {
      return {
        hasSubscriptions: jest.fn(() => {
          return true;
        }),
        on: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };
    }),
    ScProvider: jest.fn(() => {
      return {
        hasSubscriptions: jest.fn(() => {
          return true;
        }),
        on: jest.fn(),
        connect: jest.fn(() => Promise.resolve()),
        disconnect: jest.fn(),
        send: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };
    })
  };
});

describe('connector', () => {
  describe('connect', () => {
    it('should return all network apis with light-client-only config', () => {
      const ctx: ServiceContext = {
        log: mockLog,
        config: mockConfigLC
      };
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');

      const connector = new Connector(ctx);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with RPC-only config', () => {
      const ctx: ServiceContext = {
        log: mockLog,
        config: mockConfigWS
      };

      const connector = new Connector(ctx);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with a mix of light-client or RPC config', () => {
      const ctx: ServiceContext = {
        log: mockLog,
        config: mockConfigMixed
      };

      const connector = new Connector(ctx);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with relay network as the last item in the config', () => {
      const ctx: ServiceContext = {
        log: mockLog,
        config: mockConfigRelayLast
      };

      const connector = new Connector(ctx);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
      expect(ctx.log.error).toBeCalledTimes(0);
    });
  });
});
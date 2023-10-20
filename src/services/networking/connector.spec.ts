import fs from 'node:fs';

import Connector from './connector.js';
import {
  mockConfigLC,
  mockConfigMixed,
  mockConfigProviderMismatch,
  mockConfigRelayLast,
  mockConfigRelayMismatch,
  mockConfigWS
} from '../../_mocks/configs.js';
import { _Pino } from '../../_mocks/services';

jest.mock('node:fs', () => {
  const original = jest.requireActual('node:fs');
  return {
    ...original,
    readFileSync: jest.fn()
  };
});
jest.mock('@substrate/connect');

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
        connect: jest.fn(() => Promise.resolve()),
        disconnect: jest.fn(() => Promise.resolve()),
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
        disconnect: jest.fn(() => Promise.resolve()),
        send: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };
    })
  };
});

describe('connector', () => {
  it('should fail if relay is configured with RPC and parachain is configured with Smoldot', () => {
    expect(() => new Connector(_Pino, mockConfigProviderMismatch))
      .toThrowError('RPC provider cannot be used for relay chain if light client provider is being used for parachain.');
  });

  it('should fail if `relay` field in parachain config does not match WellKnown chain or relay chain config name', () => {
    expect(() => new Connector(_Pino, mockConfigRelayMismatch))
      .toThrowError('Configuration for network rococo not found.');
  });

  describe('connect', () => {
    it('should return all network apis with light-client-only config', () => {
      const connector = new Connector(_Pino, mockConfigLC);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with RPC-only config', () => {
      const connector = new Connector(_Pino, mockConfigWS);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with a mix of light-client or RPC config', () => {
      const connector = new Connector(_Pino, mockConfigMixed);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with relay network as the last item in the config', () => {
      const connector = new Connector(_Pino, mockConfigRelayLast);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return apis if already registered', () => {
      const connector = new Connector(_Pino, mockConfigWS);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);

      const apisToo = connector.connect();
      expect(apisToo).toEqual(apis);
    });
  });

  describe('disconnect', () => {
    it('should call disconnect on apis', () => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');

      const connector = new Connector(_Pino, mockConfigLC);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);

      const disconnectSpy = jest.spyOn(apis, 'disconnect');
      connector.disconnect();
      expect(disconnectSpy).toBeCalledTimes(1);
    });
  });
});
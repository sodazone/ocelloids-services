import { jest } from '@jest/globals';

import '../../_mocks/network.js';
import {
  mockConfigLC,
  mockConfigMixed,
  mockConfigProviderMismatch,
  mockConfigRelayLast,
  mockConfigRelayMismatch,
  mockConfigWS
} from '../../_mocks/configs.js';
import { _log } from '../../_mocks/services.js';

const Connector = (await import('./connector.js')).default;

describe('connector', () => {
  it('should fail if relay is configured with RPC and parachain is configured with Smoldot', () => {
    expect(() => new Connector(_log, mockConfigProviderMismatch))
      .toThrowError('RPC provider cannot be used for relay chain if light client provider is being used for parachain.');
  });

  it('should fail if `relay` field in parachain config does not match WellKnown chain or relay chain config name', () => {
    expect(() => new Connector(_log, mockConfigRelayMismatch))
      .toThrowError('Configuration for network rococo not found.');
  });

  describe('connect', () => {
    it('should return all network apis with light-client-only config', () => {
      const connector = new Connector(_log, mockConfigLC);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with RPC-only config', () => {
      const connector = new Connector(_log, mockConfigWS);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with a mix of light-client or RPC config', () => {
      const connector = new Connector(_log, mockConfigMixed);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return all network apis with relay network as the last item in the config', () => {
      const connector = new Connector(_log, mockConfigRelayLast);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);
      expect(apis.rx['0']).toBeDefined();
      expect(apis.rx['1000']).toBeDefined();
      expect(apis.rx['2006']).toBeDefined();
    });

    it('should return apis if already registered', () => {
      const connector = new Connector(_log, mockConfigWS);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);

      const apisToo = connector.connect();
      expect(apisToo).toEqual(apis);
    });
  });

  describe('disconnect', () => {
    it('should call disconnect on apis', () => {
      const connector = new Connector(_log, mockConfigLC);
      const apis = connector.connect();

      expect(apis.chains.length).toBe(3);

      const disconnectSpy = jest.spyOn(apis, 'disconnect');
      connector.disconnect();
      expect(disconnectSpy).toBeCalledTimes(1);
    });
  });
});
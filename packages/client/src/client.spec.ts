import { OcelloidsClient } from './client';

describe('OcelloidsClient', () => {
  it('should create a client instance', () => {
    expect(new OcelloidsClient({
      wsUrl: 'wss://ws.abc',
      httpUrl: 'https://rpc.abc'
    })).toBeDefined();
  });
});
import { jest } from '@jest/globals';

import { MemoryLevel } from 'memory-level';
import * as P from '@polkadot/api';
import * as C from '@sodazone/ocelloids-sdk';

import { _configToml } from './data.js';

jest.unstable_mockModule('node:fs', () => {
  return {
    default: {
      readFileSync: () => {
        return _configToml;
      },
    },
  };
});

jest.unstable_mockModule('level', async () => {
  return { Level: MemoryLevel };
});

jest.unstable_mockModule('@polkadot/api', () => {
  return {
    __esModule: true,
    ...P,
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
        unsubscribe: jest.fn(),
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
        unsubscribe: jest.fn(),
      };
    }),
  };
});

jest.unstable_mockModule('@sodazone/ocelloids-sdk', () => {
  return {
    __esModule: true,
    ...C,
    SubstrateApis: class extends C.SubstrateApis {
      get promise() {
        const p = Promise.resolve({
          registry: {
            hasType: () => true,
          },
          derive: {
            chain: {
              getBlock: () => {},
            },
          },
          rpc: {
            state: {
              getMetadata: () => ({
                toU8a: () => new Uint8Array(0),
              }),
            },
          },
        } as unknown as P.ApiPromise);
        const records: Record<string, P.ApiPromise> = {};
        for (const k of this.chains) {
          records[k] = {
            isReady: p,
          } as unknown as P.ApiPromise;
        }
        return records;
      }
    },
  };
});

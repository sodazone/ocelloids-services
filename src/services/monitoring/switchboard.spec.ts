import { jest } from '@jest/globals';

import '../../test/network.js';

import { MemoryLevel } from 'memory-level';
import { of } from 'rxjs';
import { ApiRx, ApiPromise } from '@polkadot/api';

import { _config, _services } from '../../test/services.js';
import { Scheduler } from '../persistence/scheduler';
import { SubsStore } from '../persistence/subs';
import {
  QuerySubscription,
  XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from './types';
import Connector from '../networking/connector.js';
import type { Switchboard as ST } from './switchboard.js';

jest.unstable_mockModule('./ops/xcmp.js', () => {
  return {
    extractXcmpSend: () => {
      return () => {
        return of({
          recipient: 2000,
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          messageData: {
            toHex: () => '0x0'
          }
        } as unknown as XcmMessageSentWithContext);
      };
    },
    extractXcmpReceive: () => {
      return () => {
        return of({
          recipient: 2000,
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          outcome: 'Success'
        } as unknown as XcmMessageReceivedWithContext);
      };
    }
  };
});

const Switchboard = (await import('./switchboard.js')).Switchboard;

const testSub : QuerySubscription = {
  id: '1000:2000:0',
  origin: 1000,
  senders: [
    '14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'
  ],
  destinations: [
    2000
  ],
  notify: {
    type: 'log'
  }
};

describe('switchboard service', () => {
  let switchboard : ST;
  let subs : SubsStore;
  let spy;

  beforeEach(() => {
    const db = new MemoryLevel();
    const scheduler = new Scheduler(
      _services.log,
      db,
      {
        scheduler: true,
        schedulerFrequency: 500
      }
    );

    subs = new SubsStore(
      _services.log, db, _config
    );

    switchboard = new Switchboard(
      {
        ..._services,
        connector: {
          connect: () => ({
            promise: {
              '0': {
                derive: {
                  chain: {
                    getBlock: () => {

                    }
                  }
                }
              } as unknown as ApiPromise,
              '1000': {
                derive: {
                  chain: {
                    getBlock: () => {
                    }
                  }
                },
                at: () => {
                  return Promise.resolve({
                    query: { }
                  });
                }
              } as unknown as ApiPromise,
              '2000': {
                derive: {
                  chain: {
                    getBlock: () => {
                    }
                  }
                }
              } as unknown as ApiPromise
            },
            rx: {
              '0': of({
                rpc: {
                  chain: {
                    subscribeFinalizedHeads: () => of({})
                  },
                }
              } as unknown as ApiRx),
              '1000': of({
                rpc: {
                  chain: {
                    subscribeFinalizedHeads: () => of({})
                  },
                }
              }),
              '2000': of({
                rpc: {
                  chain: {
                    subscribeFinalizedHeads: () => of({})
                  },
                }
              } as unknown as ApiRx)
            }
          })
        } as unknown as Connector,
        scheduler,
        storage: {
          ..._services.storage,
          root: db,
          subs
        }
      }
    );

    spy = jest.spyOn(switchboard, 'onNotification');
  });

  afterEach(() => switchboard.stop());

  it('should notify on matched HRMP', async () => {
    await switchboard.start();

    await switchboard.subscribe(testSub);

    await switchboard.stop();

    expect(spy).toBeCalledTimes(1);
  });

  it('should unsubscribe', async () => {
    await switchboard.subscribe(testSub);

    expect((await subs.getAll()).length).toBe(1);

    await switchboard.unsubscribe(testSub.id);

    expect((await subs.getAll()).length).toBe(0);
  });

  it('should subscribe to persisted subscriptions on start', async () => {
    await subs.insert(testSub);

    await switchboard.start();

    expect(switchboard.getSubscriptionHandler(testSub.id)).toBeDefined();
  });
});
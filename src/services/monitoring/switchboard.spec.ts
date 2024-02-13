import { jest } from '@jest/globals';

import '../../testing/network.js';

import { of, throwError } from 'rxjs';

import { _config, _services } from '../../testing/services.js';
import { SubsStore } from '../persistence/subs';
import {
  QuerySubscription,
  XcmReceivedWithContext,
  XcmSentWithContext
} from './types';
import type { Switchboard } from './switchboard.js';

jest.unstable_mockModule('./ops/xcmp.js', () => {
  return {
    extractXcmpSend: jest.fn(),
    extractXcmpReceive: jest.fn()
  };
});

jest.unstable_mockModule('./ops/ump.js', () => {
  return {
    extractUmpReceive: jest.fn(),
    extractUmpSend: jest.fn()
  };
});

const SwitchboardImpl = (await import('./switchboard.js')).Switchboard;
const { extractXcmpReceive, extractXcmpSend } = (await import('./ops/xcmp.js'));
const { extractUmpReceive, extractUmpSend } = (await import('./ops/ump.js'));

const testSub : QuerySubscription = {
  id: '1000:2000:0',
  origin: '1000',
  senders: [
    '14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'
  ],
  destinations: [
    '2000'
  ],
  channels: [{
    type: 'log'
  }]
};

describe('switchboard service', () => {
  let switchboard : Switchboard;
  let subs : SubsStore;
  //let spy;

  beforeEach(() => {
    (extractXcmpSend as jest.Mock).mockImplementation(() => {
      return () => {
        return of({
          recipient: 2000,
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          messageData: new Uint8Array([0x00])
        } as unknown as XcmSentWithContext);
      };
    });
    (extractXcmpReceive as jest.Mock).mockImplementation(() => {
      return () => {
        return of({
          recipient: 2000,
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          outcome: 'Success'
        } as unknown as XcmReceivedWithContext);
      };
    });
    (extractUmpSend as jest.Mock).mockImplementation(() => {
      return () => of({});
    });
    (extractUmpReceive as jest.Mock).mockImplementation(() => {
      return () => of({});
    });

    subs = _services.storage.subs;
    switchboard = new SwitchboardImpl(_services, {
      subscriptionMaxEphemeral: 10_00,
      subscriptionMaxPersistent: 10_000
    });
  });

  afterEach(async () => {
    await _services.storage.root.clear();
    return switchboard.stop();
  });

  it('should unsubscribe', async () => {
    await switchboard.start();

    await switchboard.subscribe(testSub);

    expect(switchboard.getSubscriptionHandler(testSub.id)).toBeDefined();
    expect(await subs.getById(testSub.id)).toBeDefined();

    await switchboard.unsubscribe(testSub.id);

    expect(switchboard.getSubscriptionHandler(testSub.id)).not.toBeDefined();
  });

  it('should notify on matched HRMP', async () => {
    await switchboard.start();

    await switchboard.subscribe(testSub);

    await switchboard.stop();

    // we can extract the NotifierHub as a service
    // to test the matched, but not really worth right now
  });

  it('should subscribe to persisted subscriptions on start', async () => {
    await subs.insert(testSub);

    await switchboard.start();

    expect(switchboard.getSubscriptionHandler(testSub.id)).toBeDefined();
  });

  it('should handle relay subscriptions', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      origin: '0'
    });

    expect(switchboard.getSubscriptionHandler(testSub.id)).toBeDefined();
  });

  it('should throw unexpected errors', async () => {
    (extractUmpSend as jest.Mock).mockImplementation(() => {
      throw new Error('unexpected');
    });
    (extractUmpReceive as jest.Mock).mockImplementation(() => {
      throw new Error('unexpected');
    });

    await switchboard.start();

    await expect(async () => {
      await switchboard.subscribe(testSub);
    }).rejects.toThrow();

    expect(switchboard.getSubscriptionHandler(testSub.id)).not.toBeDefined();

    await switchboard.stop();
  });

  it('should handle pipe errors', async () => {
    (extractUmpSend as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'));
    });
    (extractUmpReceive as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'));
    });
    (extractXcmpSend as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'));
    });
    (extractXcmpReceive as jest.Mock).mockImplementation(() => () => {
      return throwError(() => new Error('errored'));
    });

    await switchboard.start();

    await switchboard.subscribe(testSub);

    expect(switchboard.getSubscriptionHandler(testSub.id)).toBeDefined();

    await switchboard.stop();
  });

  it('should update destination subscriptions on destinations change', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      destinations: ['0', '2000']
    });

    const { destinationSubs } = switchboard.getSubscriptionHandler(testSub.id);
    expect(destinationSubs.length).toBe(2);
    expect(destinationSubs.filter(s => s.chainId === '0').length).toBe(1);
    expect(destinationSubs.filter(s => s.chainId === '2000').length).toBe(1);

    // Remove 2000 and add 3000 to destinations
    const newSub = {
      ...testSub,
      destinations: ['0', '3000']
    };
    await subs.save(newSub);

    await switchboard.updateSubscription(newSub);
    await switchboard.updateDestinations(newSub.id);
    const {
      destinationSubs: newDestinationSubs
    } = switchboard.getSubscriptionHandler(testSub.id);
    expect(newDestinationSubs.length).toBe(2);
    expect(newDestinationSubs.filter(s => s.chainId === '0').length).toBe(1);
    expect(newDestinationSubs.filter(s => s.chainId === '3000').length).toBe(1);
    expect(newDestinationSubs.filter(s => s.chainId === '2000').length).toBe(0);
  });
});
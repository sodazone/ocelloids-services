import { jest } from '@jest/globals';

import '../../testing/network.js';

import { of, throwError } from 'rxjs';

import { _services } from '../../testing/services.js';
import { SubsStore } from '../persistence/subs';
import { Subscription, XcmInboundWithContext, XcmSentWithContext, XcmNotificationType } from './types';
import type { Switchboard } from './switchboard.js';

jest.unstable_mockModule('./ops/xcmp.js', () => {
  return {
    extractXcmpSend: jest.fn(),
    extractXcmpReceive: jest.fn(),
  };
});

jest.unstable_mockModule('./ops/ump.js', () => {
  return {
    extractUmpReceive: jest.fn(),
    extractUmpSend: jest.fn(),
  };
});

const SwitchboardImpl = (await import('./switchboard.js')).Switchboard;
const { extractXcmpReceive, extractXcmpSend } = await import('./ops/xcmp.js');
const { extractUmpReceive, extractUmpSend } = await import('./ops/ump.js');

const testSub: Subscription = {
  id: '1000:2000:0',
  origin: '1000',
  senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
  destinations: ['2000'],
  channels: [
    {
      type: 'log',
    },
  ],
  events: '*',
};

describe('switchboard service', () => {
  let switchboard: Switchboard;
  let subs: SubsStore;

  beforeEach(() => {
    (extractXcmpSend as jest.Mock).mockImplementation(() => {
      return () => {
        return of({
          recipient: 2000,
          blockNumber: 1,
          blockHash: '0x0',
          messageHash: '0x0',
          messageData: new Uint8Array([0x00]),
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
          outcome: 'Success',
        } as unknown as XcmInboundWithContext);
      };
    });
    (extractUmpSend as jest.Mock).mockImplementation(() => {
      return () => of({});
    });
    (extractUmpReceive as jest.Mock).mockImplementation(() => {
      return () => of({});
    });

    subs = _services.subsStore;
    switchboard = new SwitchboardImpl(_services, {
      subscriptionMaxEphemeral: 10_00,
      subscriptionMaxPersistent: 10_000,
    });
  });

  afterEach(async () => {
    await _services.rootStore.clear();
    return switchboard.stop();
  });

  it('should unsubscribe', async () => {
    await switchboard.start();

    await switchboard.subscribe(testSub);

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined();
    expect(await subs.getById(testSub.id)).toBeDefined();

    await switchboard.unsubscribe(testSub.id);

    expect(switchboard.findSubscriptionHandler(testSub.id)).not.toBeDefined();
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

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined();
  });

  it('should handle relay subscriptions', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      origin: '0',
    });

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined();
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

    expect(switchboard.findSubscriptionHandler(testSub.id)).toBeDefined();

    await switchboard.stop();
  });

  it('should update destination subscriptions on destinations change', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      destinations: ['0', '2000'],
    });

    const { destinationSubs } = switchboard.findSubscriptionHandler(testSub.id);
    expect(destinationSubs.length).toBe(2);
    expect(destinationSubs.filter((s) => s.chainId === '0').length).toBe(1);
    expect(destinationSubs.filter((s) => s.chainId === '2000').length).toBe(1);

    // Remove 2000 and add 3000 to destinations
    const newSub = {
      ...testSub,
      destinations: ['0', '3000'],
    };
    await subs.save(newSub);

    switchboard.updateSubscription(newSub);
    switchboard.updateDestinations(newSub.id);
    const { destinationSubs: newDestinationSubs } = switchboard.findSubscriptionHandler(testSub.id);
    expect(newDestinationSubs.length).toBe(2);
    expect(newDestinationSubs.filter((s) => s.chainId === '0').length).toBe(1);
    expect(newDestinationSubs.filter((s) => s.chainId === '3000').length).toBe(1);
    expect(newDestinationSubs.filter((s) => s.chainId === '2000').length).toBe(0);
  });

  it('should create relay hrmp subscription when there is at least one HRMP pair in subscription', async () => {
    await switchboard.start();

    await switchboard.subscribe(testSub); // origin: '1000', destinations: ['2000']

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).toBeDefined();
  });

  it('should not create relay hrmp subscription when the origin is a relay chain', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      origin: '0', // origin: '0', destinations: ['2000']
    });

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).not.toBeDefined();
  });

  it('should not create relay hrmp subscription when there are no HRMP pairs in the subscription', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      destinations: ['0'], // origin: '1000', destinations: ['0']
    });

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).not.toBeDefined();
  });

  it('should not create relay hrmp subscription when relayed events are not requested', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      events: [XcmNotificationType.Received],
    });

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).not.toBeDefined();
  });

  it('should create relay hrmp subscription if relayed event is added', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      events: [XcmNotificationType.Received],
    });

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).not.toBeDefined();

    // add relayed event to subscription
    const newSub = {
      ...testSub,
      events: [XcmNotificationType.Received, XcmNotificationType.Relayed],
    };
    await subs.save(newSub);

    switchboard.updateSubscription(newSub);
    switchboard.updateEvents(newSub.id);
    const { relaySub: newRelaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(newRelaySub).toBeDefined();
  });

  it('should remove relay hrmp subscription if relayed event is removed', async () => {
    await switchboard.start();

    await switchboard.subscribe({
      ...testSub,
      events: '*',
    });

    const { relaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(relaySub).toBeDefined();

    // remove relayed event
    const newSub = {
      ...testSub,
      events: [XcmNotificationType.Received, XcmNotificationType.Sent],
    };
    await subs.save(newSub);

    switchboard.updateSubscription(newSub);
    switchboard.updateEvents(newSub.id);
    const { relaySub: newRelaySub } = switchboard.findSubscriptionHandler(testSub.id);
    expect(newRelaySub).not.toBeDefined();
  });
});

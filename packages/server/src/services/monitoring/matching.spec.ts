import { jest } from '@jest/globals';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './matching.js';
import { XcmInbound, XcmNotifyMessage } from './types.js';
import { _services } from '../../testing/services.js';
import { Janitor } from '../persistence/janitor.js';
import { matchMessages, matchHopMessages } from '../../testing/matching.js';

describe('message matching engine', () => {
  let engine: MatchingEngine;
  let db: Level;
  const cb = jest.fn((_: XcmNotifyMessage) => {});
  const schedule = jest.fn(() => {});

  beforeEach(() => {
    cb.mockReset();
    schedule.mockReset();

    // cb.mockImplementation((msg: XcmNotifyMessage) => {
    //   console.log('NOTIFY', msg.type, msg.waypoint.chainId)
    // })

    db = new Level();
    engine = new MatchingEngine({
      ..._services,
      storage: {
        ..._services.storage,
        root: db
      },
      janitor: {
        on: jest.fn(),
        schedule
      } as unknown as Janitor
    }, cb);
  });

  it('should match inbound and outbound', async () => {
    await engine.onOutboundMessage(matchMessages.origin);
    await engine.onInboundMessage(matchMessages.destination);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should match outbound and inbound', async () => {
    await engine.onInboundMessage(matchMessages.destination);
    await engine.onOutboundMessage(matchMessages.origin);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should work async concurrently', async () => {
    await Promise.all([
      engine.onOutboundMessage(matchMessages.origin),
      engine.onInboundMessage(matchMessages.destination)
    ]);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should match outbound and relay', async () => {
    await engine.onOutboundMessage(matchMessages.origin);
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should match relay and outbound', async () => {
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay);
    await engine.onOutboundMessage(matchMessages.origin);
    expect(schedule).toHaveBeenCalledTimes(3);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should match relay and outbound and inbound', async () => {
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay);
    await engine.onOutboundMessage(matchMessages.origin);
    await engine.onInboundMessage(matchMessages.destination);
    expect(schedule).toHaveBeenCalledTimes(3);

    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('should match outbound and inbound by message hash', async () => {
    const imsg: XcmInbound = {
      ...matchMessages.destination,
      messageId: matchMessages.destination.messageHash
    };
    await engine.onOutboundMessage(matchMessages.origin);
    await engine.onInboundMessage(imsg);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it.skip('should match hop messages', async () => {
    await engine.onRelayedMessage(matchHopMessages.subscriptionId, matchHopMessages.relay0);
    await engine.onOutboundMessage(matchHopMessages.origin);
    await engine.onInboundMessage(matchHopMessages.hopin);
    await engine.onOutboundMessage(matchHopMessages.hopout);
    await engine.onRelayedMessage(matchHopMessages.subscriptionId, matchHopMessages.relay2);
    await engine.onInboundMessage(matchHopMessages.destination);

    expect(cb).toHaveBeenCalledTimes(6);
  });

  it('should clean up stale data', async () => {
    async function count() {
      const iterator = db.iterator();
      await iterator.all();
      return iterator.count;
    }

    for (let i = 0; i < 100; i++) {
      await engine.onInboundMessage({
        ...matchMessages.destination,
        subscriptionId: 'z.transfers:' + i
      });
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: 'baba-yaga-1:' + i
      });
      const r = (Math.random() + 1).toString(36).substring(7);
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: r + i
      });
    }
    expect(await count()).toBe(1000);

    for (let i = 0; i < 100; i++) {
      await engine.clearPendingStates('z.transfers:' + i);
      await engine.clearPendingStates('baba-yaga-1:' + i);
    }
    expect(await count()).toBe(400);
  });
});
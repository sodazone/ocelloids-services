import { jest } from '@jest/globals';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './matching.js';
import { XcmReceived, XcmSent } from './types.js';
import { _services } from '../../testing/services.js';

const inboundMessage : XcmReceived = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  chainId: '1',
  outcome: 'Success',
  error: null,
  event: {},
  subscriptionId: '1',
  blockHash: '0xBEEF',
  blockNumber: '2'
};

const outboundMessage : XcmSent = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  recipient: '1',
  chainId: '0',
  event: {},
  instructions: {},
  messageData: '0x0',
  subscriptionId: '1',
  blockHash: '0xBEEF',
  blockNumber: '2',
  sender: {
    id: '0x123'
  }
};

describe('message matching engine', () => {
  let engine: MatchingEngine;
  let db: Level;
  const cb = jest.fn(() => {});

  beforeEach(() => {
    cb.mockReset();

    db = new Level();
    engine = new MatchingEngine({
      ..._services,
      storage: {
        ..._services.storage,
        root: db
      }
    }, cb);
  });

  it('should match inbound and outbound', async () => {
    await engine.onOutboundMessage(outboundMessage);
    await engine.onInboundMessage(inboundMessage);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should match outbound and inbound', async () => {
    await engine.onInboundMessage(inboundMessage);
    await engine.onOutboundMessage(outboundMessage);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should work async concurrently', async () => {
    await Promise.all([
      engine.onOutboundMessage(outboundMessage),
      engine.onInboundMessage(inboundMessage)
    ]);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should clean up stale data', async () => {
    async function count() {
      const iterator = db.iterator();
      await iterator.all();
      return iterator.count;
    }

    for (let i = 0; i < 100; i++) {
      await engine.onInboundMessage({
        ...inboundMessage,
        subscriptionId: 'z.transfers:' + i
      });
      await engine.onOutboundMessage({
        ...outboundMessage,
        subscriptionId: 'baba-yaga-1:' + i
      });
      const r = (Math.random() + 1).toString(36).substring(7);
      await engine.onOutboundMessage({
        ...outboundMessage,
        subscriptionId: r + i
      });
    }
    expect(await count()).toBe(600);

    for (let i = 0; i < 100; i++) {
      await engine.clearPendingStates('z.transfers:' + i);
      await engine.clearPendingStates('baba-yaga-1:' + i);
    }
    expect(await count()).toBe(200);
  });
});
import { jest } from '@jest/globals';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './matching.js';
import { XcmNotificationType, XcmReceived, XcmRelayedWithContext, XcmSent, XcmTerminiContext } from './types.js';
import { _services } from '../../testing/services.js';
import { Janitor } from '../persistence/janitor.js';

const SUBSCRIPTION_ID = '1';

const originContext: XcmTerminiContext = {
  chainId: '1000',
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
  outcome: 'Success',
  error: null
};

const outboundMessage : XcmSent = {
  type: XcmNotificationType.Sent,
  messageHash: '0xCAFE',
  messageId: '0xB000',
  legs: [
    {
      from: '1000',
      to: '0'
    },
    {
      from: '0',
      to: '2000'
    }
  ],
  destination: {
    chainId: '2000'
  },
  origin: originContext,
  waypoint: {
    ...originContext,
    legIndex: 0
  },
  instructions: {},
  messageData: '0x0',
  subscriptionId: SUBSCRIPTION_ID,
  sender: {
    id: '0x123'
  }
};

const inboundMessage : XcmReceived = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  chainId: '2000',
  outcome: 'Success',
  error: null,
  event: {},
  subscriptionId: SUBSCRIPTION_ID,
  blockHash: '0xBEEF',
  blockNumber: '2'
};

const relayMessage: XcmRelayedWithContext = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  extrinsicId: '5-1',
  blockHash: '0x828',
  blockNumber: '5',
  recipient: '2000',
  origin: '1000',
  outcome: 'Success',
  error: null
};

describe('message matching engine', () => {
  let engine: MatchingEngine;
  let db: Level;
  const cb = jest.fn(() => {});
  const schedule = jest.fn(() => {});

  beforeEach(() => {
    cb.mockReset();
    schedule.mockReset();

    db = new Level();
    engine = new MatchingEngine({
      ..._services,
      storage: {
        ..._services.storage,
        root: db
      },
      janitor: {
        schedule
      } as unknown as Janitor
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

  it('should match outbound and relay', async () => {
    await engine.onOutboundMessage(outboundMessage);
    await engine.onRelayedMessage(SUBSCRIPTION_ID, relayMessage);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should match relay and outbound', async () => {
    await engine.onRelayedMessage(SUBSCRIPTION_ID, relayMessage);
    await engine.onOutboundMessage(outboundMessage);
    expect(schedule).toHaveBeenCalledTimes(1);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should match relay and outbound and inbound', async () => {
    await engine.onRelayedMessage(SUBSCRIPTION_ID, relayMessage);
    await engine.onOutboundMessage(outboundMessage);
    await engine.onInboundMessage(inboundMessage);
    expect(schedule).toHaveBeenCalledTimes(1);

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('should match outbound and inbound by message hash', async () => {
    const imsg: XcmReceived = {
      ...inboundMessage,
      messageId: inboundMessage.messageHash
    };
    await engine.onOutboundMessage(outboundMessage);
    await engine.onInboundMessage(imsg);

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
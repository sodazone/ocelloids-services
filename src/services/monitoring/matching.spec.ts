import { jest } from '@jest/globals';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './matching.js';
import { XcmNotificationType, XcmReceived, XcmSent, XcmTerminiContext } from './types.js';
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

const originContext: XcmTerminiContext = {
  chainId: '0',
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
  outcome: 'Success',
  error: null
}

const outboundMessage : XcmSent = {
  type: XcmNotificationType.Sent,
  messageHash: '0xCAFE',
  messageId: '0xB000',
  legs: [{
    from: '0',
    to: '1'
  }],
  destination: {
    chainId: '1'
  },
  origin: originContext,
  waypoint: {
    ...originContext,
    legIndex: 0
  },
  instructions: {},
  messageData: '0x0',
  subscriptionId: '1',
  sender: {
    id: '0x123'
  }
};

describe('message matching engine', () => {
  let engine: MatchingEngine;
  const cb = jest.fn(() => {});

  beforeEach(() => {
    cb.mockReset();

    const db = new Level();
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
});
import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine, XcmNotification } from './matching.js';
import { XcmMessageReceived, XcmMessageSent } from './types.js';
import { _Services } from '../../_mocks/services.js';

const inboundMessage : XcmMessageReceived = {
  messageHash: '0xCAFE',
  chainId: '1',
  outcome: 'Success',
  error: null,
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2'
};

const outboundMessage : XcmMessageSent = {
  messageHash: '0xCAFE',
  recipient: 1,
  chainId: '0',
  event: {},
  instructions: {},
  messageData: '0x0',
  subscriptionId: '1',
  blockHash: '0xBEEF',
  blockNumber: '2'
};

describe('message matching engine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    const db = new Level();
    engine = new MatchingEngine({
      ..._Services,
      storage: {
        ..._Services.storage,
        db
      }
    });
  });

  it('should match inbound and outbound', async () => {
    const cb = jest.fn();
    engine.on(XcmNotification, cb);

    await engine.onOutboundMessage(outboundMessage);

    await engine.onInboundMessage(inboundMessage);

    expect(cb).toBeCalledTimes(1);
  });

  it('should match outbound and inbound', async () => {
    const cb = jest.fn();
    engine.on(XcmNotification, cb);

    await engine.onInboundMessage(inboundMessage);

    await engine.onOutboundMessage(outboundMessage);

    expect(cb).toBeCalledTimes(1);
  });

  it('should work async concurrently', async () => {
    const cb = jest.fn();
    engine.on(XcmNotification, cb);

    await Promise.all([
      engine.onOutboundMessage(outboundMessage),
      engine.onInboundMessage(inboundMessage)
    ]);

    expect(cb).toBeCalledTimes(1);
  });
});
import { pino } from 'pino';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine, Notification } from './engine.js';
import { XcmMessageReceivedEvent, XcmMessageSentEvent } from '../monitoring/types.js';

const inboundMessage : XcmMessageReceivedEvent = {
  messageHash: 'M0',
  chainId: '1',
  outcome: 'Success',
  error: null,
  event: {},
  blockHash: '0x0',
  blockNumber: '2'
};

const outboundMessage : XcmMessageSentEvent = {
  messageHash: 'M0',
  recipient: 1,
  chainId: '0',
  event: {},
  instructions: {},
  messageData: '0x0',
  subscriptionId: '1',
  blockHash: '0x0',
  blockNumber: '2'
};

describe('message matching engine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    const db = new Level();
    engine = new MatchingEngine(db, pino({
      enabled: false
    }));
  });

  it('should match inbound and outbound', async () => {
    const cb = jest.fn();
    engine.on(Notification, cb);

    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      outboundMessage
    );

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      inboundMessage
    );

    expect(cb).toBeCalledTimes(1);
  });

  it('should match outbound and inbound', async () => {
    const cb = jest.fn();
    engine.on(Notification, cb);

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      inboundMessage
    );

    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      outboundMessage
    );

    expect(cb).toBeCalledTimes(1);
  });

  it('should work async concurrently', async () => {
    const cb = jest.fn();
    engine.on(Notification, cb);

    await Promise.all([
      engine.onOutboundMessage(
        { chainId: '0', blockNumber: '0', blockHash: '0x0' },
        outboundMessage
      ),
      engine.onInboundMessage(
        { chainId: '1', blockNumber: '0', blockHash: '0x0' },
        inboundMessage
      )
    ]);

    expect(cb).toBeCalledTimes(1);
  });
});
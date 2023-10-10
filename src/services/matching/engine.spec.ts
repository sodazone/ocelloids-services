import { pino } from 'pino';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './engine.js';
import { XcmMessageReceivedEvent, XcmMessageSentEvent } from '../monitoring/types.js';

const inboundMessage = { messageHash: 'M0', chainId: '1', outcome: 'Sucess', error: null } as unknown as XcmMessageReceivedEvent;
const outboundMessage = { messageHash: 'M0', recipient: '1' } as unknown as XcmMessageSentEvent;

describe('message matching engine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    const db = new Level();
    engine = new MatchingEngine(db, pino({
      enabled: false
    }));
  });

  it('should match inbound and outbound', async () => {
    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      outboundMessage
    );

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      inboundMessage
    );

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should match outbound and inbound', async () => {
    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      inboundMessage
    );

    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      outboundMessage
    );

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should work async concurrently', async () => {
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

    expect(await engine.notificationsCount()).toBe(1);
  });
});
import { pino } from 'pino';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './engine.js';

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
      { messageHash: 'M0', recipient: '1' }
    );

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should match outbound and inbound', async () => {
    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0', recipient: '1' }
    );

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should tolerate duplicates', async () => {
    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0', recipient: '1' }
    );

    await engine.onOutboundMessage(
      { chainId: '0', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0', recipient: '1' }
    );

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    await engine.onInboundMessage(
      { chainId: '1', blockNumber: '0', blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    expect(await engine.notificationsCount()).toBe(1);
  });
});
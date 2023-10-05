import pino from 'pino';

import { MemoryLevel as Level } from 'memory-level';

import { MatchingEngine } from './engine.js';

describe('message matching engine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    const db = new Level();
    engine = new MatchingEngine(db, pino.default({enabled: false}));
  });

  it('should work in the happy sequence', async () => {
    await engine.waitOrigin(
      { chainId: 0, blockHash: '0x0' },
      { messageHash: 'M0', recipient: '1' }
    );

    await engine.onFinalizedBlock({
      chainId: 0, blockHash: '0x0'
    });

    await engine.waitDestination(
      { chainId: 1, blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    await engine.onFinalizedBlock({
      chainId: 1, blockHash: '0x0'
    });

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should tolerate duplicated finalizations', async () => {
    await engine.waitOrigin(
      { chainId: 0, blockHash: '0x0' },
      { messageHash: 'M0', recipient: '1' }
    );

    await engine.onFinalizedBlock({
      chainId: 0, blockHash: '0x0'
    });
    await engine.onFinalizedBlock({
      chainId: 0, blockHash: '0x0'
    });
    await engine.waitDestination(
      { chainId: 1, blockHash: '0x0' },
      { messageHash: 'M0' }
    );

    await engine.onFinalizedBlock({
      chainId: 1, blockHash: '0x0'
    });
    await engine.onFinalizedBlock({
      chainId: 1, blockHash: '0x0'
    });
    await engine.onFinalizedBlock({
      chainId: 0, blockHash: '0x0'
    });

    expect(await engine.notificationsCount()).toBe(1);
  });

  it('should work with delayed finalizations', async () => {
    const oh : string[] = [];
    const dh : string[] = [];

    for (let i = 0; i < 5; i++) {
      const blockHash = '0x' + Math.random();
      oh.push(blockHash);

      await engine.waitOrigin(
        { chainId: 0, blockHash },
        { messageHash: 'M' + i, recipient: '1' }
      );
    }

    for (let i = 0; i < 5; i++) {
      const blockHash = '0x' + Math.random();
      dh.push(blockHash);

      await engine.waitDestination(
        { chainId: 1, blockHash },
        { messageHash: 'M' + i }
      );
    }

    expect(oh.length).toBe(5);
    expect(dh.length).toBe(5);

    for (let i = 0; i < oh.length; i++) {
      await engine.onFinalizedBlock({
        chainId: 0, blockHash: oh[i]
      });
    }

    expect(await engine.notificationsCount()).toBe(0);

    for (let i = 0; i < dh.length; i++) {
      await engine.onFinalizedBlock({
        chainId: 1, blockHash: dh[i]
      });
    }

    expect(await engine.notificationsCount()).toBe(5);
  });
});
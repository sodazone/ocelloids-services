import { jest } from '@jest/globals';

import { MemoryLevel } from 'memory-level';
import { from, of } from 'rxjs';
import { ApiRx, ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';

import { _services } from '../../../testing/services.js';
import Connector from '../../networking/connector.js';
import { mockConfigMixed, mockConfigWS } from '../../../testing/configs.js';
import { interlayBlocks, polkadotBlocks, testBlocksFrom } from '../../../testing/blocks.js';
import { DB, jsonEncoded, prefixes } from '../../types.js';
import { Janitor } from '../../persistence/janitor.js';
import { BlockNumberRange, ChainHead } from '../../monitoring/types.js';
import { parachainSystemHrmpOutboundMessages, parachainSystemUpwardMessages } from '../../monitoring/storage.js';

const HeadCatcher = (await import('./head-catcher.js')).HeadCatcher;

describe('head catcher', () => {
  let db: DB;

  function sl(chainId: string) {
    return db.sublevel<string, Uint8Array>(prefixes.cache.family(chainId), {
      valueEncoding: 'buffer',
    });
  }

  beforeAll(async () => {
    db = new MemoryLevel();
  });

  afterEach(async () => {
    await db.clear();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('start', () => {
    it('should store new blocks in db for relay chain if using smoldot provider', async () => {
      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => from(polkadotBlocks),
                  },
                },
              } as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      const expectedKeys = [
        prefixes.cache.keys.block('0xaf1a3580d45b40b2fc5efd1aa0104e4caa1a20364e9cda17e6cd26032b088b5f'),
        prefixes.cache.keys.block('0x787a7e572d6a549162fb29495bab1512b8441cedbab2f48113fba9de273501bb'),
        prefixes.cache.keys.block('0x356f7d037f0ff737b13b1871cbd7a1b9b15b1a75e1e36f8cf27b84943454d875'),
      ];

      catcher.start();

      const slkeys = await sl('0').keys().all();
      expect(expectedKeys.every((k) => slkeys.includes(k))).toBe(true);

      catcher.stop();
    });

    it('should store new blocks and outbound xcm messages in db for parachain if using smoldot provider', async () => {
      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({} as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({
                at: () =>
                  of({
                    query: {
                      parachainSystem: {
                        hrmpOutboundMessages: () => [
                          {
                            length: 1,
                            toU8a: () => new Uint8Array([2, 42]),
                          },
                        ],
                        upwardMessages: () => [
                          {
                            length: 1,
                            toU8a: () => new Uint8Array([8, 31, 6]),
                          },
                        ],
                      },
                    },
                  } as unknown as ApiDecoration<'rxjs'>),
                derive: {
                  chain: {
                    subscribeNewBlocks: () => from(interlayBlocks),
                  },
                },
              } as unknown as ApiRx),
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      const expectedKeys = [
        prefixes.cache.keys.block('0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'),
        prefixes.cache.keys.block('0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'),
        prefixes.cache.keys.block('0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'),
        prefixes.cache.keys.storage(
          parachainSystemHrmpOutboundMessages,
          '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'
        ),
        prefixes.cache.keys.storage(
          parachainSystemHrmpOutboundMessages,
          '0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'
        ),
        prefixes.cache.keys.storage(
          parachainSystemHrmpOutboundMessages,
          '0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'
        ),
        prefixes.cache.keys.storage(
          parachainSystemUpwardMessages,
          '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'
        ),
        prefixes.cache.keys.storage(
          parachainSystemUpwardMessages,
          '0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'
        ),
        prefixes.cache.keys.storage(
          parachainSystemUpwardMessages,
          '0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'
        ),
      ];

      catcher.start();

      const slkeys = await sl('2032').keys().all();
      expect(expectedKeys.every((k) => slkeys.includes(k))).toBe(true);

      catcher.stop();
    });
  });

  describe('finalizedBlocks', () => {
    it('should get block from cache and delete gotten entries if using smoldot', (done) => {
      const janitor = {
        schedule: () => {},
      } as unknown as Janitor;

      const headersSource = from(polkadotBlocks.map((tb) => tb.block.header));
      const blocksSource = from(polkadotBlocks);

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    subscribeFinalizedHeads: () => from(headersSource),
                  },
                },
              } as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
            promise: {
              '0': {
                isReady: Promise.resolve({
                  derive: {
                    chain: {
                      getBlock: (hash) => of(polkadotBlocks.find((b) => b.block.hash.toHex() === hash.toHex())),
                    },
                  },
                  rpc: {
                    chain: {
                      getHeader: (hash) => {
                        return Promise.resolve(
                          polkadotBlocks.find((b) => b.block.hash.toHex() === hash.toHex())!.block.header!
                        );
                      },
                    },
                  },
                  registry: {
                    createType: () => ({}),
                    createClass: () => {
                      return class Dummy {
                        block = {
                          extrinsics: [],
                          header: {
                            number: {
                              toBigInt: () => 0n,
                            },
                          },
                        };
                      };
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
        janitor,
      });

      const janitorSpy = jest.spyOn(janitor, 'schedule');
      const expectedBlocks = [
        prefixes.cache.keys.block('0xaf1a3580d45b40b2fc5efd1aa0104e4caa1a20364e9cda17e6cd26032b088b5f'),
        prefixes.cache.keys.block('0x787a7e572d6a549162fb29495bab1512b8441cedbab2f48113fba9de273501bb'),
        prefixes.cache.keys.block('0x356f7d037f0ff737b13b1871cbd7a1b9b15b1a75e1e36f8cf27b84943454d875'),
      ];

      catcher.start();

      blocksSource.subscribe({
        complete: async () => {
          // Blocks should be put in cache
          const blockCache = await sl('0').keys().all();
          expect(expectedBlocks.every((k) => blockCache.includes(k))).toBe(true);

          catcher.finalizedBlocks('0').subscribe({
            complete: async () => {
              catcher.stop();
              done();
              expect(janitorSpy).toHaveBeenCalledTimes(3);
            },
          });
        },
      });
    });

    it('should catch up blocks', (done) => {
      // Load 20 blocks starting from #17844552
      const testBlocks = testBlocksFrom('polkadot-17844552-20.cbor.bin', 'polkadot.json');
      // Pretend that we left off at block #17844551
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('0', {
        chainId: '0',
        blockNumber: '17844551',
      } as unknown as ChainHead);

      const testHeaders = testBlocks.map((tb) => tb.block.header);
      // We will emit finalized headers with gaps to force enter catch-up logic multiple times
      const headersSource = from([testHeaders[3], testHeaders[9], testHeaders[19]]);
      const blocksSource = from(testBlocks);

      const mockGetHeader = jest.fn((hash: any) => {
        const found = testHeaders.find((h) => h.hash.toHex() === hash.toHex());
        return found ? Promise.resolve(found) : Promise.reject(`No header for ${hash.toHex()}`);
      });

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    subscribeFinalizedHeads: () => headersSource,
                  },
                },
              } as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
            promise: {
              '0': {
                isReady: Promise.resolve({
                  rpc: {
                    chain: {
                      getHeader: mockGetHeader,
                    },
                  },
                  derive: {
                    chain: {
                      getBlock: (hash) =>
                        Promise.resolve(testBlocks.find((b) => b.block.hash.toHex() === hash.toHex())),
                    },
                  },
                  registry: {
                    createType: () => ({}),
                    createClass: () => {
                      return class Dummy {
                        block = {
                          extrinsics: [],
                          header: {
                            number: {
                              toBigInt: () => 0n,
                            },
                          },
                        };
                      };
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      const cb = [jest.fn(), jest.fn()];

      catcher.start();

      blocksSource.subscribe({
        complete: async () => {
          // Blocks should be put in cache
          const blockCache = await sl('0').keys().all();
          expect(blockCache.length).toBe(20);

          let completes = 0;
          catcher.finalizedBlocks('0').subscribe({
            next: (_) => {
              cb[0]();
            },
            complete: async () => {
              expect(cb[0]).toHaveBeenCalledTimes(20);

              completes++;
              if (completes === 2) {
                catcher.stop();
                done();
              }
            },
          });

          catcher.finalizedBlocks('0').subscribe({
            next: (_) => {
              cb[1]();
            },
            complete: async () => {
              expect(cb[1]).toHaveBeenCalledTimes(20);

              completes++;
              if (completes === 2) {
                catcher.stop();
                done();
              }
            },
          });
        },
      });
    });

    it('should recover block ranges', (done) => {
      // Load 20 blocks starting from #17844552
      const testBlocks = testBlocksFrom('polkadot-17844552-20.cbor.bin', 'polkadot.json');
      // Pretend that we left off at block #17844570
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('0', {
        chainId: '0',
        blockNumber: '17844570',
      } as unknown as ChainHead);
      // Pretend that we got interrupted
      const range: BlockNumberRange = {
        fromBlockNum: '17844569',
        toBlockNum: '17844551',
      };
      db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges('0'), jsonEncoded).put(
        prefixes.cache.keys.range(range),
        range
      );
      const testHeaders = testBlocks.map((tb) => tb.block.header);
      // We will emit the last finalized headers
      const headersSource = from([testHeaders[18], testHeaders[19]]);
      const blocksSource = from(testBlocks);

      const mockGetHeader = jest.fn((hash: any) => {
        const found = testHeaders.find((h) => h.hash.toHex() === hash.toHex());
        return found ? Promise.resolve(found) : Promise.reject(new Error(`No header for ${hash.toHex()}`));
      });

      const mockGetHash = jest.fn((blockNumber: any) => {
        const found = testHeaders.find((h) => h.number.toString() === blockNumber.toString());
        return found ? Promise.resolve(found.hash) : Promise.reject(new Error(`No hash for ${blockNumber}`));
      });

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigWS,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    subscribeFinalizedHeads: () => headersSource,
                  },
                },
              } as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
            promise: {
              '0': {
                isReady: Promise.resolve({
                  rpc: {
                    chain: {
                      getBlockHash: mockGetHash,
                      getHeader: mockGetHeader,
                    },
                  },
                  derive: {
                    chain: {
                      getBlock: (hash) => {
                        return Promise.resolve(testBlocks.find((b) => b.block.hash.toHex() === hash.toHex()));
                      },
                    },
                  },
                  registry: {
                    createType: () => ({}),
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      const cb = jest.fn();

      catcher.start();

      blocksSource.subscribe({
        complete: async () => {
          catcher.finalizedBlocks('0').subscribe({
            next: (_) => {
              cb();
            },
            complete: async () => {
              catcher.stop();
              done();
              expect(cb).toHaveBeenCalledTimes(20);
            },
          });
        },
      });
    });
  });

  describe('outboundUmpMessages', () => {
    it('should construct outbound UMP messages from cached buffers if using smoldot', (done) => {
      const mockRegistry = {
        createType: jest.fn(),
      };
      const blocksSource = from(interlayBlocks);

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({} as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
              } as unknown as ApiRx),
            },
            promise: {
              '2032': {
                isReady: Promise.resolve({
                  registry: mockRegistry,
                  rpc: {
                    state: {
                      getStorage: () =>
                        Promise.resolve({
                          toU8a: () => new Uint8Array(0),
                        }),
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      catcher.start();

      let calls = 0;
      blocksSource.subscribe({
        complete: () => {
          const hash = '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0';
          catcher.getStorage('2032', parachainSystemUpwardMessages, hash).subscribe({
            next: () => {
              calls++;
            },
            complete: () => {
              expect(calls).toBe(1);
              done();
            },
          });
        },
      });

      catcher.stop();
    });

    it('should get outbound UMP messages from chain storage if using rpc', (done) => {
      const mockUpwardMessagesQuery = jest.fn(() =>
        Promise.resolve({
          toU8a: () => new Uint8Array(0),
        })
      );
      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({} as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
            promise: {
              '1000': {
                isReady: Promise.resolve({
                  rpc: {
                    state: {
                      getStorage: mockUpwardMessagesQuery,
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      catcher.getStorage('1000', parachainSystemUpwardMessages, '0x4B1D').subscribe({
        complete: () => {
          expect(mockUpwardMessagesQuery).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });

  describe('outboundHrmpMessages', () => {
    it('should construct outbound HRMP messages from cached buffers if using smoldot', (done) => {
      const mockRegistry = {
        createType: jest.fn(),
      };
      const blocksSource = from(interlayBlocks);

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({} as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
              } as unknown as ApiRx),
            },
            promise: {
              '2032': {
                isReady: Promise.resolve({
                  registry: mockRegistry,
                  rpc: {
                    state: {
                      getStorage: () =>
                        Promise.resolve({
                          toU8a: () => new Uint8Array(0),
                        }),
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      catcher.start();

      let calls = 0;
      blocksSource.subscribe({
        complete: () => {
          const hash = '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0';
          catcher.getStorage('2032', parachainSystemHrmpOutboundMessages, hash).subscribe({
            next: () => {
              calls++;
            },
            complete: () => {
              expect(calls).toBe(1);
              done();
            },
          });
        },
      });

      catcher.stop();
    });

    it('should get outbound HRMP messages from chain storage if using rpc', (done) => {
      const mockHrmpOutboundMessagesQuery = jest.fn(() =>
        Promise.resolve({
          toU8a: () => new Uint8Array(0),
        })
      );
      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({} as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx),
            },
            promise: {
              '1000': {
                isReady: Promise.resolve({
                  rpc: {
                    state: {
                      getStorage: mockHrmpOutboundMessagesQuery,
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        rootStore: db,
      });

      catcher.getStorage('1000', parachainSystemHrmpOutboundMessages, '0x4B1D').subscribe({
        complete: () => {
          expect(mockHrmpOutboundMessagesQuery).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });
});

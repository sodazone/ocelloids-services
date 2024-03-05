import { jest } from '@jest/globals';

import { MemoryLevel } from 'memory-level';
import { from, of } from 'rxjs';
import { ApiRx, ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import * as P from '@polkadot/api-derive';

import { _services } from '../../testing/services.js';
import Connector from '../networking/connector.js';
import { mockConfigMixed, mockConfigWS } from '../../testing/configs.js';
import { interlayBlocks, polkadotBlocks, testBlocksFrom } from '../../testing/blocks.js';
import { DB, jsonEncoded, prefixes } from '../types.js';
import { Janitor } from '../persistence/janitor.js';
import { BlockNumberRange, ChainHead, HexString } from './types.js';

jest.unstable_mockModule('@polkadot/api-derive', () => {
  return {
    __esModule: true,
    ...P,
    createSignedBlockExtended: () => {
      return {
        block: {
          header: {
            hash: {
              toHex: () => '0xFEEDC0DE',
            },
          },
        },
        events: {},
      } as unknown as SignedBlockExtended;
    },
  };
});

const HeadCatcher = (await import('./head-catcher.js')).HeadCatcher;

describe('head catcher', () => {
  let db: DB;

  function sl(chainId: string) {
    return db.sublevel<string, Uint8Array>(prefixes.cache.family(chainId), {
      valueEncoding: 'buffer',
    });
  }

  beforeAll(() => {
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
        config: mockConfigMixed,
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
        storage: {
          ..._services.storage,
          root: db,
        },
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
        config: mockConfigMixed,
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
        storage: {
          ..._services.storage,
          root: db,
        },
      });

      const expectedKeys = [
        prefixes.cache.keys.block('0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'),
        prefixes.cache.keys.block('0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'),
        prefixes.cache.keys.block('0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'),
        prefixes.cache.keys.hrmp('0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'),
        prefixes.cache.keys.hrmp('0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'),
        prefixes.cache.keys.hrmp('0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'),
        prefixes.cache.keys.ump('0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0'),
        prefixes.cache.keys.ump('0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c'),
        prefixes.cache.keys.ump('0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'),
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
        config: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
                rpc: {
                  chain: {
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
                        return Promise.resolve(polkadotBlocks.find((b) => b.block.hash.toHex() === hash.toHex())!.block.header!);
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
        storage: {
          ..._services.storage,
          root: db,
        },
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
              expect(janitorSpy).toHaveBeenCalledTimes(3);
              catcher.stop();
              done();
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
        config: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
                rpc: {
                  chain: {
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
                      getBlock: (hash) => Promise.resolve(testBlocks.find((b) => b.block.hash.toHex() === hash.toHex())),
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
        storage: {
          ..._services.storage,
          root: db,
        },
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
      db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges('0'), jsonEncoded).put(prefixes.cache.keys.range(range), range);
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
        config: mockConfigWS,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
                rpc: {
                  chain: {
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
        storage: {
          ..._services.storage,
          root: db,
        },
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
              expect(cb).toHaveBeenCalledTimes(20);
              catcher.stop();
              done();
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
        config: mockConfigMixed,
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
                            length: 0,
                            toU8a: jest.fn(),
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
                    subscribeNewBlocks: () => blocksSource,
                  },
                },
              } as unknown as ApiRx),
            },
            promise: {
              '2032': {
                isReady: Promise.resolve({
                  registry: mockRegistry,
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        storage: {
          ..._services.storage,
          root: db,
        },
      });

      catcher.start();

      blocksSource.subscribe({
        complete: () => {
          const hash: HexString = '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0';
          catcher
            .outboundUmpMessages('2032')(hash)
            .subscribe({
              complete: () => {
                expect(mockRegistry.createType).toHaveBeenCalledTimes(1);
                done();
              },
            });
        },
      });

      catcher.stop();
    });

    it('should get outbound UMP messages from chain storage if using rpc', (done) => {
      const mockUpwardMessagesQuery = jest.fn(() => Promise.resolve({}));
      const catcher = new HeadCatcher({
        ..._services,
        config: mockConfigMixed,
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
                  at: () =>
                    Promise.resolve({
                      query: {
                        parachainSystem: {
                          upwardMessages: mockUpwardMessagesQuery,
                        },
                      },
                    } as unknown as ApiDecoration<'promise'>),
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        storage: {
          ..._services.storage,
          root: db,
        },
      });

      catcher
        .outboundUmpMessages('1000')('0x4B1D')
        .subscribe({
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
        config: mockConfigMixed,
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
                            toU8a: () => new Uint8Array([8, 31, 6]),
                          },
                        ],
                        upwardMessages: () => [
                          {
                            length: 0,
                            toU8a: jest.fn(),
                          },
                        ],
                      },
                    },
                  } as unknown as ApiDecoration<'rxjs'>),
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
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        storage: {
          ..._services.storage,
          root: db,
        },
      });

      catcher.start();

      blocksSource.subscribe({
        complete: () => {
          const hash: HexString = '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0';
          catcher
            .outboundHrmpMessages('2032')(hash)
            .subscribe({
              complete: () => {
                expect(mockRegistry.createType).toHaveBeenCalledTimes(1);
                done();
              },
            });
        },
      });

      catcher.stop();
    });

    it('should get outbound HRMP messages from chain storage if using rpc', (done) => {
      const mockHrmpOutboundMessagesQuery = jest.fn(() => Promise.resolve({}));
      const catcher = new HeadCatcher({
        ..._services,
        config: mockConfigMixed,
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
                  at: () =>
                    Promise.resolve({
                      query: {
                        parachainSystem: {
                          hrmpOutboundMessages: mockHrmpOutboundMessagesQuery,
                        },
                      },
                    } as unknown as ApiDecoration<'promise'>),
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        storage: {
          ..._services.storage,
          root: db,
        },
      });

      catcher
        .outboundHrmpMessages('1000')('0x4B1D')
        .subscribe({
          complete: () => {
            expect(mockHrmpOutboundMessagesQuery).toHaveBeenCalledTimes(1);
            done();
          },
        });
    });
  });
});

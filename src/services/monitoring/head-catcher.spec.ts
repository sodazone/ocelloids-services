import { jest } from '@jest/globals';

import { MemoryLevel } from 'memory-level';
import { from, of } from 'rxjs';
import { ApiRx, ApiPromise } from '@polkadot/api';
// import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import { ApiDecoration } from '@polkadot/api/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import * as P from '@polkadot/api-derive';

import { _services } from '../../test/services.js';
import Connector from '../networking/connector.js';
import { mockConfigMixed } from '../../test/configs.js';
import { interlayBlocks, polkadotBlocks } from '../../test/blocks.js';
import { DB } from '../types.js';
import { Janitor } from '../persistence/janitor.js';
import type { HeadCatcher as HC } from './head-catcher.js';

jest.unstable_mockModule('@polkadot/api-derive', () => {
  // const originalModule = await import('@polkadot/api-derive');
  return {
    __esModule: true,
    ...P,
    createSignedBlockExtended: () => {
      return {
        block: {
          header: {
            hash: {
              toHex: () => '0xFEEDC0DE'
            }
          }
        },
        events: {}
      } as unknown as SignedBlockExtended;
    }
  };
});

const HeadCatcher = (await import('./head-catcher.js')).HeadCatcher;

describe('head catcher', () => {
  let catcher: HC;
  let db: DB;

  function sl(chainId: string) {
    return db.sublevel<string, Uint8Array>(
      chainId + ':blocks',
      {
        valueEncoding: 'buffer'
      }
    );
  }

  beforeEach(() => {
    db = new MemoryLevel();
  });

  afterEach(done => {
    db.close();
    done();
  });

  describe('start', () => {
    it(
      'should store new blocks in db for relay chain if using smoldot provider',
      async () => {
        catcher = new HeadCatcher({
          ..._services,
          config: mockConfigMixed,
          connector: {
            connect: () => ({
              rx: {
                '0': of({
                  derive: {
                    chain: {
                      subscribeNewBlocks: () => from(polkadotBlocks)
                    },
                  }
                } as unknown as ApiRx),
                '1000': of({} as unknown as ApiRx),
                '2032': of({} as unknown as ApiRx)
              }
            })
          } as unknown as Connector,
          storage: {
            ..._services.storage,
            root: db
          }
        });

        const expectedKeys = [
          '0xaf1a3580d45b40b2fc5efd1aa0104e4caa1a20364e9cda17e6cd26032b088b5f',
          '0x787a7e572d6a549162fb29495bab1512b8441cedbab2f48113fba9de273501bb',
          '0x356f7d037f0ff737b13b1871cbd7a1b9b15b1a75e1e36f8cf27b84943454d875'
        ];

        catcher.start();

        const slkeys = await sl('0').keys().all();
        expect(expectedKeys.every(k => slkeys.includes(k))).toBe(true);

        catcher.stop();
      });

    it(
      'should store new blocks and outbound xcm messages in db for parachain if using smoldot provider',
      async () => {
        catcher = new HeadCatcher({
          ..._services,
          config: mockConfigMixed,
          connector: {
            connect: () => ({
              rx: {
                '0': of({} as unknown as ApiRx),
                '1000': of({} as unknown as ApiRx),
                '2032': of({
                  at: () => of({
                    query: {
                      parachainSystem: {
                        hrmpOutboundMessages: () => [
                          {
                            length: 1,
                            toU8a: () => new Uint8Array([2, 42])
                          }
                        ],
                        upwardMessages: () => [
                          {
                            length: 1,
                            toU8a: () => new Uint8Array([8, 31, 6])
                          }
                        ]
                      }
                    }
                  } as unknown as ApiDecoration<'rxjs'>),
                  derive: {
                    chain: {
                      subscribeNewBlocks: () => from(interlayBlocks)
                    },
                  }
                } as unknown as ApiRx)
              }
            })
          } as unknown as Connector,
          storage: {
            ..._services.storage,
            root: db
          }
        });

        const expectedKeys = [
          '0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0',
          '0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c',
          '0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b',
          'hrmp-messages:0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0',
          'hrmp-messages:0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c',
          'hrmp-messages:0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b',
          'ump-messages:0x0137cd64c09a46e3790ac01d30333bbf4c47b593cea736eec12e3df959dd06b0',
          'ump-messages:0x6af1c1a60b82e41dec4b49ca110a198f3a2133aba10f1c320667e06d80cd8a7c',
          'ump-messages:0x90ad4002e0510aa202bd8dafd3c9ef868acf57f2ed60ed70c9aa85a648d66b1b'
        ];

        catcher.start();

        const slkeys = await sl('2032').keys().all();
        expect(expectedKeys.every(k => slkeys.includes(k))).toBe(true);

        catcher.stop();
      });
  });

  describe('finalizedBlocks', () => {
    it('should get block from cache and delete gotten entries if using smoldot', (done) => {
      const janitor = {
        schedule: () => {}
      } as unknown as Janitor;

      const headersSource = from(polkadotBlocks.map(tb => tb.block.header));
      const blocksSource = from(polkadotBlocks);

      catcher = new HeadCatcher({
        ..._services,
        config: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              '0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    getBlock: (hash) => of(
                      polkadotBlocks.find(
                        b => b.block.hash.toHex() === hash.toHex()
                      )
                    )
                  },
                },
                rpc: {
                  chain: {
                    subscribeFinalizedHeads: () => from(headersSource)
                  },
                },
              } as unknown as ApiRx),
              '1000': of({} as unknown as ApiRx),
              '2032': of({} as unknown as ApiRx)
            },
            promise: {
              '0': {
                derive: {
                  chain: {
                    getBlock: (hash: Uint8Array | string) => of(
                      polkadotBlocks.find(
                        b => b.block.hash.eq(hash)
                      )
                    )
                  },
                },
                registry: {
                  createType: () => ({})
                }
              } as unknown as ApiPromise
            }
          })
        } as unknown as Connector,
        storage: {
          ..._services.storage,
          root: db
        },
        janitor
      });

      const janitorSpy = jest.spyOn(janitor, 'schedule');
      const expectedBlocks = [
        '0xaf1a3580d45b40b2fc5efd1aa0104e4caa1a20364e9cda17e6cd26032b088b5f',
        '0x787a7e572d6a549162fb29495bab1512b8441cedbab2f48113fba9de273501bb',
        '0x356f7d037f0ff737b13b1871cbd7a1b9b15b1a75e1e36f8cf27b84943454d875'
      ];

      catcher.start();

      blocksSource.subscribe({
        complete: async () => {
          // Blocks should be put in cache
          const blockCache = await sl('0').keys().all();
          expect(expectedBlocks.every(k => blockCache.includes(k))).toBe(true);

          catcher.finalizedBlocks('0').subscribe({
            next: _ => {
              expect(janitorSpy).toBeCalledWith({
                sublevel: '0:blocks',
                key: 'hrmp-messages:0xFEEDC0DE'
              },
              {
                sublevel: '0:blocks',
                key: 'ump-messages:0xFEEDC0DE'
              },
              {
                sublevel: '0:blocks',
                key: '0xFEEDC0DE'
              });
            },
            complete: async () => {
              // Blocks should be deleted from cache
              const blockCacheAfter = await sl('0').keys().all();
              expect(blockCacheAfter.length).toBe(0);
              expect(janitorSpy).toBeCalledTimes(3);
              catcher.stop();
              done();
            }
          });
        }
      });
    });
  });
});
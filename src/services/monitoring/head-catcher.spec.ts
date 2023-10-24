import { MemoryLevel } from 'memory-level';
import { of, Subject } from 'rxjs';
import { ApiRx } from '@polkadot/api';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';

import { HeadCatcher } from './head-catcher.js';
import { _services } from '../../test/services.js';
import Connector from '../networking/connector.js';
import { mockConfigMixed } from '../../test/configs.js';
import { polkadotBlocks } from '../../test/apis.js';

describe('head catcher', () => {
  let catcher: HeadCatcher;
  let polkadotNewBlocksSub: Subject<SignedBlockExtended>;
  let interlayNewBlocksSub: Subject<SignedBlockExtended>;

  const db = new MemoryLevel();
  function sl(chainId: string) {
    return db.sublevel<string, Uint8Array>(
      chainId + ':blocks',
      {
        valueEncoding: 'buffer'
      }
    );
  }

  beforeEach(() => {
    polkadotNewBlocksSub = new Subject<SignedBlockExtended>();
    interlayNewBlocksSub = new Subject<SignedBlockExtended>();
    catcher = new HeadCatcher({
      ..._services,
      config: mockConfigMixed,
      connector: {
        connect: () => ({
          rx: {
            '0': of({
              derive: {
                chain: {
                  subscribeNewBlocks: () => polkadotNewBlocksSub
                },
              }
            } as unknown as ApiRx),
            '1000': of({} as unknown as ApiRx),
            '2032': of({
              derive: {
                chain: {
                  subscribeNewBlocks: () => interlayNewBlocksSub
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
  });

  afterEach(() => db.clear());

  afterAll(done => {
    db.close();
    done();
  });

  describe('start', () => {
    it('should store new blocks in db for relay chain if using smoldot provider', done => {
      polkadotNewBlocksSub.subscribe({
        complete: async () => {
          const slkeys = await sl('0').keys().all();

          expect(slkeys).toEqual([
            '0xaf1a3580d45b40b2fc5efd1aa0104e4caa1a20364e9cda17e6cd26032b088b5f'
          ]);
          done();
        }
      });

      catcher.start();
      polkadotNewBlocksSub.next(polkadotBlocks[0]);
      polkadotNewBlocksSub.complete();
      interlayNewBlocksSub.complete();
    });
  });
});
import { EventEmitter } from 'node:events';

import { Observable, Subscription, mergeMap, from } from 'rxjs';
import { encode, decode } from 'cbor-x';

import { Registry } from '@polkadot/types-codec/types';
import type { EventRecord, AccountId } from '@polkadot/types/interfaces';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import { createSignedBlockExtended } from '@polkadot/api-derive';

import {
  blocks,
  finalizedHeads,
  finalizedBlocks,
  retryWithTruncatedExpBackoff,
  SubstrateApis
} from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { DB } from '../../types.js';
import { ServiceContext } from '../../context.js';

type BinBlock = {
  block: Uint8Array;
  events: Uint8Array[];
  author?: Uint8Array;
}

/**
 *
 */
export class BlockCache extends EventEmitter {
  #apis: SubstrateApis;
  #ctx: ServiceContext;
  #db: DB;

  #subs: Record<string, Subscription> = {};

  constructor(
    ctx: ServiceContext,
    connector: Connector,
    db: DB
  ) {
    super();

    this.#apis = connector.connect();
    this.#ctx = ctx;
    this.#db = db;
  }

  start() {
    const { log, config } = this.#ctx;

    for (const network of config.networks) {
      // We only need to cache for smoldot
      if (network.provider.type === 'smoldot') {
        const chainId = network.id.toString();
        const api = this.#apis.rx[chainId];
        const db = this.#blockCache(chainId);

        this.#subs[chainId] = api.pipe(
          blocks(),
          retryWithTruncatedExpBackoff()
        ).subscribe({
          next: async block => {
            await db.put(block.hash.toHex(), encode({
              block: block.toU8a(),
              events: block.events.map(ev => ev.toU8a()),
              author: block.author?.toU8a()
            }));
          },
          error: error => log.error(
            `Error on caching block for chain ${chainId}`, error
          )
        });
      }
    }
  }

  stop() {
    const { log } = this.#ctx;
    log.info('Stopping Block Cache');

    for (const [chain, sub] of Object.entries(this.#subs)) {
      log.info(`Unsubscribe block cache of chain ${chain}`);
      sub.unsubscribe();
      delete this.#subs[chain];
    }
  }

  #hasSub(chainId: string) {
    return this.#subs[chainId] !== undefined;
  }

  async #getBlock(
    chainId: string,
    registry: Registry,
    hash: string
  ) {
    const cache = this.#blockCache(chainId);
    const buffer = await cache.get(hash);
    const b: BinBlock = decode(buffer);
    const block = registry.createType('SignedBlock', b.block);
    const records = registry.createType('Vec<EventRecord>', b.events, true);
    const author = registry.createType('AccountId', b.author);

    const sBlock = createSignedBlockExtended(
      registry,
      block as SignedBlockExtended,
      records as unknown as EventRecord[],
      null,
      author as AccountId
    );

    await cache.del(hash);

    return sBlock;
  }

  /**
   * Returns a signed block extended observable with cached new block
   * content when needed.
   *
   * When using Smoldot as parachain light client, the finalized blocks content
   * could not be retrieve since the block announcements never contain the "best"
   * flag. This makes that the peers-bet block map is never updated after the
   * initial announcement handshake, which in turn makes that the block content
   * cannot be retrieved. See:
   * https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/sync_service.rs#L507
   * https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/json_rpc_service/background.rs#L713
   */
  finalizedBlocks(chainId: string) : Observable<SignedBlockExtended> {
    if (this.#hasSub(chainId)) {
      const api = this.#apis.promise[chainId];
      return this.#apis.rx[chainId].pipe(
        finalizedHeads(),
        retryWithTruncatedExpBackoff(),
        mergeMap(head => {
          return from(this.#getBlock(
            chainId, api.registry, head.hash.toHex()
          ));
        })
      );
    }

    return this.#apis.rx[chainId].pipe(
      finalizedBlocks(),
      retryWithTruncatedExpBackoff()
    );
  }

  #blockCache(chainId: string) {
    return this.#db.sublevel<string, Uint8Array>(
      chainId + ':blocks',
      {
        valueEncoding: 'buffer'
      }
    );
  }
}
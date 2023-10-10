import { EventEmitter } from 'node:events';

import { Observable, Subscription, mergeMap, from, tap } from 'rxjs';
import { encode, decode } from 'cbor-x';

import type { Header, EventRecord, AccountId } from '@polkadot/types/interfaces';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import { ApiPromise } from '@polkadot/api';
import { createSignedBlockExtended } from '@polkadot/api-derive';

import {
  blocks,
  finalizedHeads,
  blockFromHeader,
  retryWithTruncatedExpBackoff,
  SubstrateApis
} from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { DB } from '../../types.js';
import { ServiceContext } from '../../context.js';
import { ChainHead } from '../types.js';

type BinBlock = {
  block: Uint8Array;
  events: Uint8Array[];
  author?: Uint8Array;
}

function max(...args: bigint[]) {
  return args.reduce((m, e) => e > m ? e : m);
}

/**
 * The HeadCatcher performs the following tasks ("moo" 🐮):
 * - Catches up with block headers based on the height gap for finalized blocks.
 * - Caches seen extended signed blocks and supplies them when required on finalization.
 *
 * @see {HeadCatcher.finalizedBlocks}
 * @see {HeadCatcher.#catchUpHeads}
 */
export class HeadCatcher extends EventEmitter {
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

        log.info('[%s] Register resilient head hunter', chainId);

        this.#subs[chainId] = api.pipe(
          blocks(),
          tap(b => log.info(
            '[%s] SEEN block %s (%s)',
            chainId,
            b.block.header.hash.toHex(),
            b.block.header.number.toString()
          )),
          retryWithTruncatedExpBackoff()
        ).subscribe({
          next: async block => {
            const hash = block.block.header.hash.toHex();
            await db.put(hash, encode({
              block: block.toU8a(),
              events: block.events.map(ev => ev.toU8a()),
              author: block.author?.toU8a()
            }));
          },
          error: error => log.error(
            error,
            '[%s] Error on caching block for chain',
            chainId
          )
        });
      }
    }
  }

  stop() {
    const { log } = this.#ctx;
    log.info('Stopping Head Catcher');

    for (const [chain, sub] of Object.entries(this.#subs)) {
      log.info(`Unsubscribe head catcher of chain ${chain}`);
      sub.unsubscribe();
      delete this.#subs[chain];
    }
  }

  /**
   * Returns an observable of extended signed blocks, providing cached block content as needed.
   *
   * When using Smoldot as a parachain light client, it cannot retrieve finalized block content
   * after the finalized block height surpasses the "best" number from the initial handshake.
   * This occurs because the block announcements never contain the "best" flag. As a result, the mapping
   * of peers to the "best" block is never updated after the initial announcement handshake. Consequently,
   * the block content cannot be retrieved due to Smoldot's retrieval logic. See:
   * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/sync_service.rs#L507
   * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/json_rpc_service/background.rs#L713
   */
  finalizedBlocks(chainId: string) : Observable<SignedBlockExtended> {
    const api = this.#apis.promise[chainId];

    if (this.#hasSub(chainId)) {
      return this.#apis.rx[chainId].pipe(
        finalizedHeads(),
        retryWithTruncatedExpBackoff(),
        this.#catchUpHeads(chainId, api),
        mergeMap(head => {
          return from(this.#getBlock(
            chainId, api, head.hash.toHex()
          ));
        }),
        retryWithTruncatedExpBackoff()
      );
    }

    return this.#apis.rx[chainId].pipe(
      finalizedHeads(),
      retryWithTruncatedExpBackoff(),
      this.#catchUpHeads(chainId, api),
      blockFromHeader(api),
      retryWithTruncatedExpBackoff()
    );
  }

  /**
   * Returns true if there is a subscription for the
   * "head catcher" logic, i.e. block caching and catch-up.
   *
   * @private
   */
  #hasSub(chainId: string) {
    return this.#subs[chainId] !== undefined;
  }

  /**
   * Gets a persisted extended signed block from the storage or
   * tries to get it from the network if not found.
   *
   * @private
   */
  async #getBlock(
    chainId: string,
    api: ApiPromise,
    hash: string
  ) {
    try {
      const cache = this.#blockCache(chainId);
      const buffer = await cache.get(hash);
      const b: BinBlock = decode(buffer);

      const registry = api.registry;
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
    } catch (error) {
      // Fallback to try from API
      return await api.derive.chain.getBlock(hash);
    }
  }

  get #chainHeads() {
    return this.#db.sublevel<string, ChainHead>(
      'finalized-heads', { valueEncoding: 'json'}
    );
  }

  /**
   * Catches up the blockchain heads by fetching missing blocks between the current stored
   * head and the new incoming head, and updates the storage with the latest head information.
   * This function throttles the requests to avoid overwhelming the network.
   *
   * @private
   */
  #catchUpHeads(chainId: string, api: ApiPromise) {
    const { log } = this.#ctx;

    let memHeight : bigint = BigInt(0);

    return (source: Observable<Header>)
    : Observable<Header> => {
      return source.pipe(
        mergeMap(async head => {
          const bnHeadNum = head.number.toBigInt();
          let currentHeight: bigint;
          try {
            const  currentHead = await this.#chainHeads.get(chainId);
            currentHeight = max(BigInt(currentHead.blockNumber), memHeight);
          } catch (error) {
            currentHeight = bnHeadNum;
          }

          const heads : Header[] = [];

          heads.push(head);

          log.info('[%s] FINALIZED block %s (%s)',
            chainId,
            head.hash.toHex(),
            bnHeadNum
          );

          const chainHead: ChainHead = {
            chainId,
            blockNumber: head.number.toString(),
            blockHash: head.hash.toHex(),
            parentHash: head.parentHash.toHex(),
            receivedAt: new Date()
          };

          // avoid re-entrant overlaps
          memHeight = max(memHeight, bnHeadNum);

          let parentHead = head;
          while (parentHead.number.toBigInt() - currentHeight > 1) {
            parentHead = await api.rpc.chain.getHeader(parentHead.parentHash);
            heads.push(parentHead);

            log.info(
              '[%s] FINALIZED CATCH-UP block %s (%s)',
              chainId,
              parentHead.hash.toHex(),
              parentHead.number.toBigInt()
            );

            // Throttle
            // TODO: configurable
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          if (heads.length > 1) {
            log.info(
              '[%s] FINALIZED caught up range %s-%s',
              chainId,
              currentHeight,
              bnHeadNum
            );
          }

          // Update the head in storage
          await this.#chainHeads.put(chainId, chainHead);

          return heads;
        }),
        retryWithTruncatedExpBackoff(),
        mergeMap(head => head)
      );
    };
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
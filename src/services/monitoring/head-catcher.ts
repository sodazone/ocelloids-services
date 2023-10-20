import { EventEmitter } from 'node:events';

import { Observable, Subscription, combineLatest, share, mergeMap, from, tap, switchMap, map } from 'rxjs';
import { encode, decode } from 'cbor-x';

import type { Header, EventRecord, AccountId } from '@polkadot/types/interfaces';
import type { Vec, Bytes } from '@polkadot/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ApiPromise } from '@polkadot/api';
import { createSignedBlockExtended } from '@polkadot/api-derive';

import {
  blocks,
  finalizedHeads,
  blockFromHeader,
  retryWithTruncatedExpBackoff,
  SubstrateApis
} from '@sodazone/ocelloids';

import { DB, Logger, Services } from '../types.js';
import { ChainHead, BinBlock, GetOutboundHrmpMessages, GetOutboundUmpMessages, HexString } from './types.js';
import { Janitor } from 'services/storage/janitor.js';
import { ServiceConfiguration } from 'services/configuration.js';

function max(...args: bigint[]) {
  return args.reduce((m, e) => e > m ? e : m);
}

/**
 * The HeadCatcher performs the following tasks ("moo" 🐮):
 * - Catches up with block headers based on the height gap for finalized blocks.
 * - Caches seen extended signed blocks and supplies them when required on finalization.
 * - Caches storage data from XCM queues.
 *
 * @see {HeadCatcher.finalizedBlocks}
 * @see {HeadCatcher.#catchUpHeads}
 */
export class HeadCatcher extends EventEmitter {
  #apis: SubstrateApis;
  #log: Logger;
  #config: ServiceConfiguration;
  #db: DB;
  #janitor: Janitor;

  #subs: Record<string, Subscription> = {};
  #pipes: Record<string, Observable<any>> = {};

  constructor(
    {
      log,
      config,
      storage: { db },
      janitor,
      connector
    }: Services
  ) {
    super();

    this.#log = log;
    this.#config = config;
    this.#apis = connector.connect();
    this.#db = db;
    this.#janitor = janitor;
  }

  start() {
    const { networks } = this.#config;

    for (const network of networks) {
      // We only need to cache for smoldot
      if (network.provider.type === 'smoldot') {
        const chainId = network.id.toString();
        const isRelayChain = network.relay === undefined;
        const api = this.#apis.rx[chainId];
        const db = this.#blockCache(chainId);

        this.#log.info('[%s] Register head catcher', chainId);
        const blockPipe = api.pipe(
          blocks(),
          tap(b => this.#log.info(
            '[%s] SEEN block #%s %s',
            chainId,
            b.block.header.number.toString(),
            b.block.header.hash.toHex()
          )),
          retryWithTruncatedExpBackoff()
        );
        const paraPipe = blockPipe.pipe(
          mergeMap(block => {
            return api.pipe(
              switchMap(_api => _api.at(block.block.header.hash)),
              mergeMap(at =>
                combineLatest([
                  from(
                    at.query.parachainSystem.hrmpOutboundMessages()
                  ) as Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>,
                  from(
                    at.query.parachainSystem.upwardMessages()
                  ) as Observable<Vec<Bytes>>
                ])
              ),
              retryWithTruncatedExpBackoff(),
              map(([hrmpMessages, umpMessages]) =>  {
                return {
                  block,
                  hrmpMessages,
                  umpMessages
                };
              })
            );
          })
        );

        if (isRelayChain) {
          this.#subs[chainId] = blockPipe.subscribe(
            {
              next: async (block) => {
                this.#putBlock(block);
              },
              error: error => this.#log.error(
                error,
                '[%s] Error on caching block for relay chain',
                chainId
              )
            }
          );
        } else {
          this.#subs[chainId] = paraPipe.subscribe(
            {
              next: async ({ block, hrmpMessages, umpMessages }) => {
                this.#putBlock(block);
                const hash = block.block.header.hash.toHex();
                if (hrmpMessages.length > 0) {
                  await db.put('hrmp-messages:' + hash, hrmpMessages.toU8a());
                }
                if (umpMessages.length > 0) {
                  await db.put('ump-messages:' + hash, umpMessages.toU8a());
                }
              },
              error: error => this.#log.error(
                error,
                '[%s] Error on caching block and XCMP messages for parachain',
                chainId
              )
            }
          );
        }
      }
    }
  }

  stop() {
    this.#log.info('Stopping head catcher');

    for (const [chain, sub] of Object.entries(this.#subs)) {
      this.#log.info(`Unsubscribe head catcher of chain ${chain}`);
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
  finalizedBlocks(
    chainId: string
  ) : Observable<SignedBlockExtended> {
    const api = this.#apis.promise[chainId];
    let pipe = this.#pipes[chainId];

    if (pipe) {
      return pipe;
    }

    if (this.hasCache(chainId)) {
      pipe = this.#apis.rx[chainId].pipe(
        finalizedHeads(),
        retryWithTruncatedExpBackoff(),
        this.#catchUpHeads(chainId, api),
        mergeMap(head => {
          return from(this.#getBlock(
            chainId, api, head.hash.toHex()
          ));
        }),
        retryWithTruncatedExpBackoff(),
        tap(this.#updateJanitorTasks(chainId)),
        share()
      );
    } else {
      pipe = this.#apis.rx[chainId].pipe(
        finalizedHeads(),
        retryWithTruncatedExpBackoff(),
        this.#catchUpHeads(chainId, api),
        blockFromHeader(api),
        retryWithTruncatedExpBackoff(),
        share()
      );
    }

    this.#pipes[chainId] = pipe;
    return pipe;
  }

  outboundHrmpMessages(chainId: string) : GetOutboundHrmpMessages {
    const api = this.#apis.promise[chainId];
    const db = this.#blockCache(chainId);

    if (this.hasCache(chainId)) {
      return (hash: HexString)
      : Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>> => {
        return from(db.get('hrmp-messages:' + hash)).pipe(
          map(buffer => {
            return api.registry.createType(
              'Vec<PolkadotCorePrimitivesOutboundHrmpMessage>', buffer
            ) as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>;
          })
        );
      };
    } else {
      return (hash: HexString)
      : Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>> => {
        return from(api.at(hash)).pipe(
          retryWithTruncatedExpBackoff(),
          switchMap(at =>
           from(
             at.query.parachainSystem.hrmpOutboundMessages()
           ) as Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>
          ),
          retryWithTruncatedExpBackoff()
        );
      };
    }
  }

  // TODO: refactor outbound cached together with hrmp
  outboundUmpMessages(chainId: string) : GetOutboundUmpMessages {
    const api = this.#apis.promise[chainId];
    const db = this.#blockCache(chainId);

    if (this.hasCache(chainId)) {
      return (hash: HexString)
      : Observable<Vec<Bytes>> => {
        return from(db.get('ump-messages:' + hash)).pipe(
          map(buffer => {
            return api.registry.createType(
              'Vec<Bytes>', buffer
            ) as Vec<Bytes>;
          })
        );
      };
    } else {
      return (hash: HexString)
      : Observable<Vec<Bytes>> => {
        return from(api.at(hash)).pipe(
          retryWithTruncatedExpBackoff(),
          switchMap(at =>
           from(
             at.query.parachainSystem.upwardMessages()
           ) as Observable<Vec<Bytes>>
          ),
          retryWithTruncatedExpBackoff()
        );
      };
    }
  }

  /**
   * Returns true if there is a subscription for the
   * "head catcher" logic, i.e. block caching and catch-up.
   *
   * @private
   */
  hasCache(chainId: string) {
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

      cache.del(hash).catch(err => {
        this.#log.error(err, 'Error deleting cached block');
      });

      return sBlock;
    } catch (error) {
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
  #catchUpHeads(
    chainId: string,
    api: ApiPromise
  ) {
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

          this.#log.info('[%s] FINALIZED block #%s %s',
            chainId,
            bnHeadNum,
            head.hash.toHex()
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

          if (memHeight - currentHeight > 1) {
            this.#log.info(
              '[%s] FINALIZED catching up from #%s to #%s',
              chainId,
              currentHeight,
              memHeight
            );
          }

          let parentHead = head;

          while (parentHead.number.toBigInt() - currentHeight > 1) {
            parentHead = await api.rpc.chain.getHeader(parentHead.parentHash);
            heads.push(parentHead);

            // TODO: log every n blocks
            this.#log.info(
              '[%s] FINALIZED CATCH-UP block #%s %s',
              chainId,
              parentHead.number.toBigInt(),
              parentHead.hash.toHex()
            );

            // Throttle
            // TODO: configurable
            await new Promise(resolve => setTimeout(resolve, 500));
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

  async #putBlock(block: SignedBlockExtended) {
    const hash = block.block.header.hash.toHex();

    // TODO: review to use SCALE instead of CBOR
    await this.#db.put(hash, encode({
      block: block.toU8a(),
      events: block.events.map(ev => ev.toU8a()),
      author: block.author?.toU8a()
    }));
  }

  #updateJanitorTasks(chainId: string) {
    return ({ block: { header } }: SignedBlockExtended) => {
      this.#janitor.schedule(
        {
          sublevel: chainId + ':blocks',
          key: 'hrmp-messages:' + header.hash.toHex()
        },
        {
          sublevel: chainId + ':blocks',
          key: 'ump-messages:' + header.hash.toHex()
        },
        {
          sublevel: chainId + ':blocks',
          key: header.hash.toHex()
        }
      );
    };
  }
}
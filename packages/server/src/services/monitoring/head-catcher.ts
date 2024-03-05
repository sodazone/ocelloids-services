import { EventEmitter } from 'node:events';

import {
  Observable,
  Subscription,
  mergeAll,
  zip,
  share,
  mergeMap,
  mergeWith,
  from,
  tap,
  switchMap,
  map,
  catchError,
  EMPTY,
  BehaviorSubject,
  finalize,
  of,
} from 'rxjs';
import { encode, decode } from 'cbor-x';
import { Mutex } from 'async-mutex';

import type { Header, EventRecord, AccountId } from '@polkadot/types/interfaces';
import type { Vec, Bytes } from '@polkadot/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ApiPromise } from '@polkadot/api';
import { createSignedBlockExtended } from '@polkadot/api-derive';

import { blocks, finalizedHeads, blockFromHeader, retryWithTruncatedExpBackoff, SubstrateApis } from '@sodazone/ocelloids';

import { DB, Logger, Services, jsonEncoded, prefixes } from '../types.js';
import { ChainHead as ChainTip, BinBlock, HexString, BlockNumberRange } from './types.js';
import { GetOutboundHrmpMessages, GetOutboundUmpMessages } from './types-augmented.js';
import { Janitor } from '../../services/persistence/janitor.js';
import { ServiceConfiguration } from '../../services/config.js';
import { TelemetryEventEmitter } from '../telemetry/types.js';

const MAX_BLOCK_DIST: bigint = process.env.XCMON_MAX_BLOCK_DIST ? BigInt(process.env.XCMON_MAX_BLOCK_DIST) : 50n; // maximum distance in #blocks
const max = (...args: bigint[]) => args.reduce((m, e) => (e > m ? e : m));

function arrayOfTargetHeights(newHeight: bigint, targetHeight: bigint, batchSize: bigint) {
  const targets = [];
  let n: bigint = newHeight;

  while (n > targetHeight) {
    if (n - targetHeight >= batchSize) {
      n -= batchSize;
    } else {
      n = targetHeight;
    }
    targets.push(n);
  }

  return targets;
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
export class HeadCatcher extends (EventEmitter as new () => TelemetryEventEmitter) {
  #apis: SubstrateApis;
  #log: Logger;
  #config: ServiceConfiguration;
  #db: DB;
  #janitor: Janitor;

  #mutex: Record<string, Mutex> = {};
  #subs: Record<string, Subscription> = {};
  #pipes: Record<string, Observable<any>> = {};

  constructor({ log, config, storage: { root: db }, janitor, connector }: Services) {
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

        this.#log.info('[%s] Register head catcher', chainId);

        const block$ = api.pipe(
          blocks(),
          retryWithTruncatedExpBackoff(),
          tap(({ block: { header } }) => {
            this.#log.debug('[%s] SEEN block #%s %s', chainId, header.number.toString(), header.hash.toHex());

            this.emit('telemetryBlockSeen', {
              chainId,
              header,
            });
          })
        );
        const msgs$ = block$.pipe(
          mergeMap((block) => {
            return api.pipe(
              switchMap((_api) => _api.at(block.block.header.hash)),
              mergeMap((at) =>
                zip([
                  from(at.query.parachainSystem.hrmpOutboundMessages()) as Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>,
                  from(at.query.parachainSystem.upwardMessages()) as Observable<Vec<Bytes>>,
                ])
              ),
              this.#tapError(chainId, 'zip(hrmpOutboundMessages & upwardMessages)'),
              retryWithTruncatedExpBackoff(),
              map(([hrmpMessages, umpMessages]) => {
                return {
                  block,
                  hrmpMessages,
                  umpMessages,
                };
              })
            );
          })
        );

        if (isRelayChain) {
          this.#subs[chainId] = block$
            .pipe(
              map((block) => from(this.#putBlockBuffer(chainId, block))),
              mergeAll()
            )
            .subscribe({
              error: (error) => this.#log.error(error, '[%s] Error on caching block for relay chain', chainId),
            });
        } else {
          this.#subs[chainId] = msgs$
            .pipe(
              map(({ block, hrmpMessages, umpMessages }) => {
                const ops = [from(this.#putBlockBuffer(chainId, block))];
                const hash = block.block.header.hash.toHex();

                if (hrmpMessages.length > 0) {
                  ops.push(from(this.#putBuffer(chainId, prefixes.cache.keys.hrmp(hash), hrmpMessages.toU8a())));
                }
                if (umpMessages.length > 0) {
                  ops.push(from(this.#putBuffer(chainId, prefixes.cache.keys.ump(hash), umpMessages.toU8a())));
                }
                return ops;
              }),
              mergeAll()
            )
            .subscribe({
              error: (error) => this.#log.error(error, '[%s] Error on caching block and XCMP messages for parachain', chainId),
            });
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
  finalizedBlocks(chainId: string): Observable<SignedBlockExtended> {
    const apiRx = this.#apis.rx[chainId];
    const apiPromiseObs = from(this.#apis.promise[chainId].isReady);
    let pipe = this.#pipes[chainId];

    if (pipe) {
      this.#log.debug('[%s] returning cached pipe', chainId);
      return pipe;
    }

    if (this.#hasCache(chainId)) {
      // only applies to light clients
      // TODO: check if can recover ranges
      pipe = apiPromiseObs.pipe(
        switchMap((api) =>
          apiRx.pipe(
            finalizedHeads(),
            this.#tapError(chainId, 'finalizedHeads()'),
            retryWithTruncatedExpBackoff(),
            this.#catchUpHeads(chainId, api),
            mergeMap((head) => from(this.#getBlock(chainId, api, head.hash.toHex()))),
            this.#tapError(chainId, '#getBlock()'),
            retryWithTruncatedExpBackoff()
          )
        ),
        share()
      );
    } else {
      pipe = apiPromiseObs.pipe(
        switchMap((api) =>
          apiRx.pipe(
            finalizedHeads(),
            mergeWith(from(this.#recoverRanges(chainId)).pipe(this.#recoverBlockRanges(chainId, api))),
            this.#tapError(chainId, 'finalizedHeads()'),
            retryWithTruncatedExpBackoff(),
            this.#catchUpHeads(chainId, api),
            blockFromHeader(api),
            this.#tapError(chainId, 'blockFromHeader()'),
            retryWithTruncatedExpBackoff()
          )
        ),
        share()
      );
    }

    this.#pipes[chainId] = pipe;

    this.#log.debug('[%s] created pipe', chainId);

    return pipe;
  }

  /**
   * Returns outbound HRMP messages either from data cached in previously seen blocks,
   * or from a query storage request to the network.
   */
  outboundHrmpMessages(chainId: string): GetOutboundHrmpMessages {
    const apiPromiseObs = from(this.#apis.promise[chainId].isReady);
    const cache = this.#bufferCache(chainId);

    if (this.#hasCache(chainId)) {
      return (hash: HexString): Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>> => {
        // TODO: handle error not found in cache
        return apiPromiseObs.pipe(
          switchMap((api) =>
            from(cache.get(prefixes.cache.keys.hrmp(hash))).pipe(
              map((buffer) => {
                return api.registry.createType(
                  'Vec<PolkadotCorePrimitivesOutboundHrmpMessage>',
                  buffer
                ) as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>;
              })
            )
          ),
          this.#tapError(chainId, 'at.cache.parachainSystem.hrmpOutboundMessages()')
        );
      };
    } else {
      return (hash: HexString): Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>> => {
        return apiPromiseObs.pipe(
          switchMap((api) =>
            from(api.at(hash)).pipe(
              switchMap(
                (at) => from(at.query.parachainSystem.hrmpOutboundMessages()) as Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>
              ),
              this.#tapError(chainId, 'at.query.parachainSystem.hrmpOutboundMessages()'),
              retryWithTruncatedExpBackoff()
            )
          )
        );
      };
    }
  }

  /**
   * Returns outbound UMP messages either from data cached in previously seen blocks,
   * or from a query storage request to the network.
   */
  outboundUmpMessages(chainId: string): GetOutboundUmpMessages {
    const apiPromiseObs = from(this.#apis.promise[chainId].isReady);
    const cache = this.#bufferCache(chainId);

    if (this.#hasCache(chainId)) {
      return (hash: HexString): Observable<Vec<Bytes>> => {
        // TODO: handle error not found in cache
        return apiPromiseObs.pipe(
          switchMap((api) =>
            from(cache.get(prefixes.cache.keys.ump(hash))).pipe(
              map((buffer) => {
                return api.registry.createType('Vec<Bytes>', buffer) as Vec<Bytes>;
              })
            )
          ),
          this.#tapError(chainId, 'at.cache.parachainSystem.upwardMessages()')
        );
      };
    } else {
      return (hash: HexString): Observable<Vec<Bytes>> => {
        return apiPromiseObs.pipe(
          switchMap((api) =>
            from(api.at(hash)).pipe(
              switchMap((at) => from(at.query.parachainSystem.upwardMessages()) as Observable<Vec<Bytes>>),
              this.#tapError(chainId, 'at.query.parachainSystem.upwardMessages()'),
              retryWithTruncatedExpBackoff()
            )
          )
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
  #hasCache(chainId: string) {
    return this.#subs[chainId] !== undefined;
  }

  /**
   * Gets a persisted extended signed block from the storage or
   * tries to get it from the network if not found.
   *
   * @private
   */
  async #getBlock(chainId: string, api: ApiPromise, hash: HexString) {
    try {
      const buffer = await this.#bufferCache(chainId).get(prefixes.cache.keys.block(hash));
      const binBlock: BinBlock = decode(buffer);

      const registry = api.registry;
      const block = registry.createType('SignedBlock', binBlock.block);
      const records = registry.createType('Vec<EventRecord>', binBlock.events, true);
      const author = registry.createType('AccountId', binBlock.author);

      const signedBlock = createSignedBlockExtended(
        registry,
        block as SignedBlockExtended,
        records as unknown as EventRecord[],
        null,
        author as AccountId
      );

      this.emit('telemetryBlockCacheHit', {
        chainId,
      });

      return signedBlock;
    } catch (error) {
      const apiReady = await api.isReady;
      return await apiReady.derive.chain.getBlock(hash);
    }
  }

  get #chainTips() {
    return this.#db.sublevel<string, ChainTip>(prefixes.cache.tips, jsonEncoded);
  }

  #pendingRanges(chainId: string) {
    return this.#db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges(chainId), jsonEncoded);
  }

  /**
   * Catches up the blockchain heads by fetching missing blocks between the current stored
   * head and the new incoming head, and updates the storage with the highest head information.
   *
   * Returns an array of heads containing the current head from the source along the heads
   * of the block range gap.
   *
   * It supports block range batching and interruption recovery. Both options are configurable
   * at the network level.
   *
   * @private
   */
  #catchUpHeads(chainId: string, api: ApiPromise) {
    return (source: Observable<Header>): Observable<Header> => {
      return source.pipe(
        tap((header) => {
          this.#log.info('[%s] FINALIZED block #%s %s', chainId, header.number.toBigInt(), header.hash.toHex());

          this.emit('telemetryBlockFinalized', {
            chainId,
            header,
          });
        }),
        mergeMap((header) => from(this.#targetHeights(chainId, header)).pipe(this.#catchUpToHeight(chainId, api, header))),
        this.#tapError(chainId, '#catchUpHeads()'),
        retryWithTruncatedExpBackoff()
      );
    };
  }

  #recoverBlockRanges(chainId: string, api: ApiPromise) {
    return (source: Observable<BlockNumberRange[]>): Observable<Header> => {
      const batchSize = this.#batchSize(chainId);
      return source.pipe(
        mergeAll(),
        mergeMap((range) =>
          from(api.rpc.chain.getBlockHash(range.fromBlockNum).then((hash) => api.rpc.chain.getHeader(hash))).pipe(
            catchError((error) => {
              this.#log.warn('[%s] in #recoverBlockRanges(%s-%s) %s', chainId, range.fromBlockNum, range.toBlockNum, error);
              return EMPTY;
            }),
            mergeMap((head) =>
              of(arrayOfTargetHeights(BigInt(range.fromBlockNum), BigInt(range.toBlockNum), batchSize)).pipe(
                this.#catchUpToHeight(chainId, api, head)
              )
            )
          )
        )
      );
    };
  }

  async #recoverRanges(chainId: string) {
    const networkConfig = this.#config.networks.find((n) => n.id === chainId);
    if (networkConfig && networkConfig.recovery) {
      return await (await this.#pendingRanges(chainId).values()).all();
    } else {
      return [];
    }
  }

  async #targetHeights(chainId: string, head: Header) {
    if (this.#mutex[chainId] === undefined) {
      this.#mutex[chainId] = new Mutex();
    }

    const release = await this.#mutex[chainId].acquire();

    try {
      const newHeadNum = head.number.toBigInt();
      let currentHeight: bigint;

      const chainTip: ChainTip = {
        chainId,
        blockNumber: head.number.toString(),
        blockHash: head.hash.toHex(),
        parentHash: head.parentHash.toHex(),
        receivedAt: new Date(),
      };

      try {
        const currentTip = await this.#chainTips.get(chainId);
        currentHeight = BigInt(currentTip.blockNumber);
      } catch (error) {
        currentHeight = newHeadNum;
      }

      const blockDistance = newHeadNum - currentHeight;

      if (blockDistance < 2n) {
        // nothing to catch
        await this.#chainTips.put(chainId, chainTip);
        return [];
      }

      const batchSize = this.#batchSize(chainId);

      // cap by distance
      const targetHeight = max(newHeadNum - MAX_BLOCK_DIST, currentHeight);

      const range: BlockNumberRange = {
        fromBlockNum: newHeadNum.toString(),
        toBlockNum: targetHeight.toString(),
      };
      const rangeKey = prefixes.cache.keys.range(range);

      // signal the range as pending
      // should be removed on complete
      await this.#pendingRanges(chainId).put(rangeKey, range);

      this.#log.info('[%s] BEGIN RANGE %s', chainId, rangeKey);

      if (currentHeight < newHeadNum) {
        await this.#chainTips.put(chainId, chainTip);
      }

      return arrayOfTargetHeights(newHeadNum, targetHeight, batchSize);
    } finally {
      release();
    }
  }

  #headers(api: ApiPromise, newHead: Header, targetHeight: bigint, prev: Header[]): Observable<Header[]> {
    return from(api.rpc.chain.getHeader(newHead.parentHash)).pipe(
      switchMap((header) =>
        header.number.toBigInt() - 1n <= targetHeight ? of([header, ...prev]) : this.#headers(api, header, targetHeight, [header, ...prev])
      )
    );
  }

  #catchUpToHeight(chainId: string, api: ApiPromise, newHead: Header) {
    return (source: Observable<bigint[]>): Observable<Header> => {
      return source.pipe(
        mergeMap((targets) => {
          if (targets.length === 0) {
            return of(newHead);
          }

          const batchControl = new BehaviorSubject({
            index: 0,
            target: targets[0],
            head: newHead,
            collect: [newHead],
          });

          return batchControl.pipe(
            mergeMap(({ target, head, collect }) =>
              (head.number.toBigInt() - 1n === target ? of([head]) : this.#headers(api, head, target, collect)).pipe(
                map((heads) => {
                  if (batchControl.value.index === targets.length - 1) {
                    batchControl.complete();
                  } else {
                    const batch = batchControl.value;
                    const index = batch.index + 1;
                    batchControl.next({
                      index,
                      target: targets[index],
                      head: heads[0],
                      collect: [],
                    });
                  }
                  return heads;
                }),
                mergeAll()
              )
            ),
            catchError((error) => {
              this.#log.warn('[%s] in #catchUpToHeight(%s) %s', chainId, targets, error);
              return EMPTY;
            }),
            tap({
              complete: async () => {
                // on complete we will clear the pending range
                const range: BlockNumberRange = {
                  fromBlockNum: newHead.number.toString(),
                  toBlockNum: batchControl.value.target.toString(),
                };
                const rangeKey = prefixes.cache.keys.range(range);

                await this.#pendingRanges(chainId).del(rangeKey);

                this.#log.info('[%s] COMPLETE RANGE %s', chainId, rangeKey);
              },
            }),
            finalize(async () => {
              const fullRange: BlockNumberRange = {
                fromBlockNum: newHead.number.toString(),
                toBlockNum: targets[targets.length - 1].toString(),
              };
              const currentRange: BlockNumberRange = {
                fromBlockNum: batchControl.value.head.number.toString(),
                toBlockNum: batchControl.value.target.toString(),
              };

              const fullRangeKey = prefixes.cache.keys.range(fullRange);
              const currentRangeKey = prefixes.cache.keys.range(currentRange);

              try {
                if (fullRange.toBlockNum !== currentRange.toBlockNum) {
                  const dbBatch = this.#pendingRanges(chainId).batch();
                  await dbBatch.del(fullRangeKey).put(currentRangeKey, currentRange).write();

                  this.#log.info('[%s] stale range to recover %s', chainId, prefixes.cache.keys.range(currentRange));
                }
              } catch (err) {
                this.#log.warn('Error while writing stale ranges', err);
              }
            })
          );
        })
      );
    };
  }

  /**
   * Binary cache by chain id.
   */
  #bufferCache(chainId: string) {
    return this.#db.sublevel<string, Uint8Array>(prefixes.cache.family(chainId), {
      valueEncoding: 'buffer',
    });
  }

  /**
   * Puts into the binary cache.
   */
  async #putBuffer(chainId: string, key: string, buffer: Uint8Array) {
    const db = this.#bufferCache(chainId);
    await db.put(key, buffer);

    await this.#janitor.schedule({
      sublevel: prefixes.cache.family(chainId),
      key,
    });
  }

  async #putBlockBuffer(chainId: string, block: SignedBlockExtended) {
    const hash = block.block.header.hash.toHex();
    const key = prefixes.cache.keys.block(hash);

    // TODO: review to use SCALE instead of CBOR
    await this.#bufferCache(chainId).put(
      key,
      encode({
        block: block.toU8a(),
        events: block.events.map((ev) => ev.toU8a()),
        author: block.author?.toU8a(),
      })
    );

    await this.#janitor.schedule({
      sublevel: prefixes.cache.family(chainId),
      key,
    });
  }

  #batchSize(chainId: string) {
    const networkConfig = this.#config.networks.find((n) => n.id === chainId);
    return BigInt(networkConfig?.batchSize ?? 25);
  }

  #tapError<T>(chainId: string, method: string) {
    return tap<T>({
      error: (e) => {
        this.#log.warn(e, 'error on method=%s, chain=%s', method, chainId);
        this.emit('telemetryHeadCatcherError', {
          chainId,
          method,
        });
      },
    });
  }
}

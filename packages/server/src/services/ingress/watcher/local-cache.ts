import { EventEmitter } from 'node:events';

import { SubstrateApis, blocks, retryWithTruncatedExpBackoff } from '@sodazone/ocelloids';

import { Subscription, Observable, mergeAll, zip, mergeMap, from, tap, switchMap, map } from 'rxjs';

import type { Vec, Bytes } from '@polkadot/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ApiPromise } from '@polkadot/api';

import { Services, DB, Logger, prefixes } from '../../types.js';
import { HexString } from '../../monitoring/types.js';
import { parachainSystemHrmpOutboundMessages, parachainSystemUpwardMessages } from '../../monitoring/storage.js';
import { NetworkConfiguration } from '../../config.js';
import { Janitor } from '../../persistence/janitor.js';
import { TelemetryEventEmitter } from '../../telemetry/types.js';

import { decodeSignedBlockExtended, encodeSignedBlockExtended } from './codec.js';

/**
 * A local cache for seen blocks and storage items.
 *
 * When using Smoldot as a parachain light client, it cannot retrieve finalized block content
 * after the finalized block height surpasses the "best" number from the initial handshake.
 * This occurs because the block announcements never contain the "best" flag. As a result, the mapping
 * of peers to the "best" block is never updated after the initial announcement handshake. Consequently,
 * the block content cannot be retrieved due to Smoldot's retrieval logic. See:
 * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/sync_service.rs#L507
 * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/json_rpc_service/background.rs#L713
 */
export class LocalCache extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger;
  readonly #db: DB;
  readonly #janitor: Janitor;
  readonly #apis: SubstrateApis;

  readonly #subs: Record<string, Subscription> = {};

  constructor(apis: SubstrateApis, { log, rootStore, janitor }: Services) {
    super();

    this.#log = log;
    this.#apis = apis;
    this.#janitor = janitor;
    this.#db = rootStore;
  }

  /**
   * Caches produced blocks and storage items.
   *
   * @param network The network configuration
   */
  watch(network: NetworkConfiguration) {
    const chainId = network.id.toString();
    const isRelayChain = network.relay === undefined;
    const api = this.#apis.rx[chainId];

    this.#log.info('[%s] Register block cache', chainId);

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

    // TODO configurable storage items by storage key to keep
    // XXX this should not be hardcoded
    const msgs$ = block$.pipe(
      mergeMap((block) => {
        return api.pipe(
          switchMap((_api) => _api.at(block.block.header.hash)),
          mergeMap((at) =>
            zip([
              from(at.query.parachainSystem.hrmpOutboundMessages()) as Observable<
                Vec<PolkadotCorePrimitivesOutboundHrmpMessage>
              >,
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
              ops.push(
                from(
                  this.#putBuffer(
                    chainId,
                    prefixes.cache.keys.storage(parachainSystemHrmpOutboundMessages, hash),
                    hrmpMessages.toU8a()
                  )
                )
              );
            }
            if (umpMessages.length > 0) {
              ops.push(
                from(
                  this.#putBuffer(
                    chainId,
                    prefixes.cache.keys.storage(parachainSystemUpwardMessages, hash),
                    umpMessages.toU8a()
                  )
                )
              );
            }
            return ops;
          }),
          mergeAll()
        )
        .subscribe({
          error: (error) =>
            this.#log.error(error, '[%s] Error on caching block and XCMP messages for parachain', chainId),
        });
    }
  }

  /**
   * Gets a persisted extended signed block from the storage or
   * tries to get it from the network if not found.
   */
  async getBlock(chainId: string, api: ApiPromise, hash: HexString) {
    try {
      const buffer = await this.#bufferCache(chainId).get(prefixes.cache.keys.block(hash));
      const signedBlock = decodeSignedBlockExtended(api.registry, buffer);

      this.emit('telemetryBlockCacheHit', {
        chainId,
      });

      return signedBlock;
    } catch (_error) {
      this.#log.warn('[%s] GET block after cache miss (%s)', chainId, hash);

      const apiReady = await api.isReady;
      return await apiReady.derive.chain.getBlock(hash);
    }
  }

  async getStorage(chainId: string, storageKey: HexString, blockHash?: HexString) {
    try {
      const buffer = await this.#bufferCache(chainId).get(prefixes.cache.keys.storage(storageKey, blockHash));

      // TODO event
      this.emit('telemetryBlockCacheHit', {
        chainId,
      });

      return buffer;
    } catch (error) {
      return null;
    }
  }

  /**
   * Returns true if there is a subscription for the
   * block caching.
   *
   */
  has(chainId: string) {
    return this.#subs[chainId] !== undefined;
  }

  stop() {
    for (const [chain, sub] of Object.entries(this.#subs)) {
      this.#log.info(`Unsubscribe block cache of chain ${chain}`);
      sub.unsubscribe();
      delete this.#subs[chain];
    }
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
    await this.#bufferCache(chainId).put(key, encodeSignedBlockExtended(block));

    await this.#janitor.schedule({
      sublevel: prefixes.cache.family(chainId),
      key,
    });
  }

  #tapError<T>(chainId: string, method: string) {
    return tap<T>({
      error: (e) => {
        this.#log.warn(e, 'error on method=%s, chain=%s', method, chainId);
        this.emit('telemetryBlockCacheError', {
          chainId,
          method,
        });
      },
    });
  }
}

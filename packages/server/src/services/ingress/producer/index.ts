import { Subscription as RxSubscription } from 'rxjs';

import {
  NetworksKey,
  RedisDistributor,
  XAddOptions,
  getBlockStreamKey,
  getMetadataKey,
  getStorageReqKey,
  getVersionKey,
} from '../distributor.js';
import { HeadCatcher } from '../watcher/head-catcher.js';
import { Logger, Services, OcnURN } from '../../types.js';
import { ServiceConfiguration } from '../../config.js';
import { HexString } from '../../monitoring/types.js';
import { IngressOptions } from '../../../types.js';

import { encodeSignedBlockExtended } from '../watcher/codec.js';

type StorageRequest = {
  replyTo: string;
  storageKey: HexString;
  at: HexString;
};

/**
 * IngressProducer is responsible for managing the ingress process, including:
 * - Publishing blocks into Redis streams
 * - Publishing runtime metadata into Redis streams
 * - Providing blockchain storage data through asynchronous request-reply
 * - Writing network configuration into a Redis set
 */
export default class IngressProducer {
  readonly #log: Logger;
  readonly #headCatcher: HeadCatcher;
  readonly #distributor: RedisDistributor;
  readonly #rxSubs: Record<string, RxSubscription> = {};
  readonly #streamOptions: XAddOptions;

  #config: ServiceConfiguration;

  constructor(ctx: Services, opts: IngressOptions) {
    this.#log = ctx.log;

    this.#headCatcher = new HeadCatcher(ctx);
    this.#config = ctx.localConfig;
    this.#streamOptions = {
      TRIM: {
        strategy: 'MAXLEN',
        strategyModifier: '~',
        threshold: 1000,
      },
    };
    this.#distributor = new RedisDistributor(opts, ctx);
  }

  async start() {
    await this.#distributor.start();

    this.#headCatcher.start();

    await this.#writeNetworkConfig();

    // don't wait
    this.#initializeStreams();
  }

  async stop() {
    this.#log.info('Stopping ingress producer');

    for (const [chainId, rxSub] of Object.entries(this.#rxSubs)) {
      this.#log.info('[%s] RX Unsubscribe', chainId);

      rxSub.unsubscribe();
    }

    this.#headCatcher.stop();

    await this.#distributor.stop();
  }

  async #initializeStreams() {
    const chainIds = this.#headCatcher.chainIds;

    for (const chainId of chainIds) {
      const key = getBlockStreamKey(chainId);

      this.#log.info('[%s] Block Stream [key=%s]', chainId, key);

      // TODO implement using RX + retry
      const api = await this.#headCatcher.getApiPromise(chainId).isReady;
      const versionKey = getVersionKey(chainId);
      const runtimeVersion = await this.#distributor.get(versionKey);
      const chainRuntimeVersion = await api.rpc.state.getRuntimeVersion();
      const chainSpecVersion = chainRuntimeVersion.specVersion.toString();

      this.#log.info('[%s] Runtime version %s [current=%s]', chainId, runtimeVersion ?? 'unknown', chainSpecVersion);

      if (chainSpecVersion !== runtimeVersion) {
        this.#log.info('[%s] GET metadata', chainId);

        const metadata = await api.rpc.state.getMetadata();
        const metadataKey = getMetadataKey(chainId);

        this.#log.info('[%s] UPDATE metadata [key=%s,spec=%s]', chainId, metadataKey, chainSpecVersion);
        await this.#distributor.mset([metadataKey, Buffer.from(metadata.toU8a())], [versionKey, chainSpecVersion]);
      }

      this.#rxSubs[chainId] = this.#headCatcher.finalizedBlocks(chainId).subscribe({
        next: (block) => {
          this.#distributor.addBytes(key, encodeSignedBlockExtended(block), this.#streamOptions);
        },
      });

      this.#registerStorageRequestHandler(chainId);
    }
  }

  async #writeNetworkConfig() {
    // TODO handle DELETE
    const networks = [];
    for (const network of this.#config.networks) {
      networks.push({
        id: network.id,
        name: network.name,
        isRelay: network.relay === undefined,
      });

      this.#log.info(
        '[%s] WRITE network configuration (name=%s,relay=%s)',
        network.id,
        network.name,
        network.relay ?? 'n/a'
      );
    }
    await this.#distributor.sadd(
      NetworksKey,
      networks.map((network) => JSON.stringify(network))
    );
  }

  #registerStorageRequestHandler(chainId: OcnURN) {
    const key = getStorageReqKey(chainId);
    this.#distributor.read<StorageRequest>(key, (request, { client }) => {
      this.#headCatcher.getStorage(chainId, request.storageKey, request.at).subscribe((data) => {
        client.LPUSH(request.replyTo, Buffer.from(data));
      });
    });
  }
}

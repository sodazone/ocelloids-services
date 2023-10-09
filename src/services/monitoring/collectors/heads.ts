import { EventEmitter } from 'node:events';

import { Subscription, map } from 'rxjs';
import { finalizedHeads } from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { DB, GenericSubstrateApis } from '../../types.js';
import { ServiceContext } from '../../context.js';
import { ChainHead } from '../types.js';

export class FinalizedHeadCollector extends EventEmitter {
  #apis: GenericSubstrateApis;
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
    const { log } = this.#ctx;

    this.#apis.chains.forEach(
      chain => {
        this.#subs[chain] = this.#apis.rx[chain]
          .pipe(
            finalizedHeads(),
            map(head => ({
              head,
              chainId: chain
            }))
          ).subscribe({
            next: async ({ head, chainId }) => {
              // TODO: no chain id

              const  currentHead = await this.#chainHeads.get(chainId);

              const currentHeight = BigInt(currentHead.blockNumber);

              log.info(`CURRENT HEIGHT ${currentHeight} ${chainId}`);

              const chainHead: ChainHead = {
                chainId,
                blockNumber: head.number.toString(),
                blockHash: head.hash.toHex(),
                parentHash: head.parentHash.toHex(),
                receivedAt: new Date()
              };
              this.#chainHeads.put(chainId, chainHead);

              // TODO: to address
              // . stop while catching up
              // . getHeader fail

              let parentHead = head;
              while (parentHead.number.toBigInt() - currentHeight > 1) {
                log.warn(`Catching up ${chainId} from ${currentHeight} to ${parentHead.number.toString()}`);
                const api = await this.#apis.promise[chain].isReady;
                parentHead = await api.rpc.chain.getHeader(parentHead.parentHash);
                this.emit(
                  'head',
                  { chainId, head: parentHead }
                );
              }

              // Emit current head
              this.emit(
                'head',
                { chainId, head }
              );
            },
            error: (error) => log.error(
              `Error on finalized block subscription of chain ${chain}`,
              error
            )
          });
      }
    );
  }

  stop() {
    const { log } = this.#ctx;
    log.info('Stopping Finalized Collector');

    for (const [chain, sub] of Object.entries(this.#subs)) {
      log.info(`Unsubscribe finalized heads of chain ${chain}`);
      sub.unsubscribe();
      delete this.#subs[chain];
    }
  }

  async listHeads() {
    return await this.#chainHeads.values().all();
  }

  get #chainHeads() {
    return this.#db.sublevel<string, ChainHead>(
      'finalized-heads', { valueEncoding: 'json'}
    );
  }
}
import { EventEmitter } from 'node:events';

import { Subscription, map } from 'rxjs';
import { finalizedHeads } from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { DB, DefaultSubstrateApis } from '../../types.js';
import { ServiceContext } from '../../context.js';
import { ChainHead } from '../types.js';

export class FinalizedHeadCollector extends EventEmitter {
  #apis: DefaultSubstrateApis;
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
            next: ({ head, chainId }) => {
              const chainHead: ChainHead = {
                chainId,
                blockNumber: head.number.toString(),
                blockHash: head.hash.toHex(),
                receivedAt: new Date()
              };
              this.#chainHeads.put(chainId, chainHead);
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
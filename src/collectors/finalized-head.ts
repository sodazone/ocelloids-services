import { EventEmitter } from 'node:events';

import { Subscription, map } from 'rxjs';
import { finalizedHeads } from '@sodazone/ocelloids';

import Connector from '../connector.js';
import { DefaultSubstrateApis } from '../types.js';
import { ServiceContext } from '../context.js';

export class FinalizedCollector extends EventEmitter {
  #apis: DefaultSubstrateApis;
  #ctx: ServiceContext;

  #subs: Record<string, Subscription> = {};

  constructor(
    ctx: ServiceContext,
    connector: Connector
  ) {
    super();

    this.#apis = connector.connect();
    this.#ctx = ctx;
  }

  start() {
    this.#apis.chains.forEach(
      chain => {
        this.#subs[chain] = this.#apis.rx[chain].pipe(
          finalizedHeads(),
          map(head => ({
            head,
            chainId: chain
          }))
        ).subscribe({
          next: ({ head, chainId }) => this.emit('head', { chainId, head }),
          error: (error) => this.#ctx.log.error(`Error on finalized block subscription of chain ${chain}`, error)
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
}
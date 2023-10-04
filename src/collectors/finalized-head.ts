import { EventEmitter } from 'node:events';

import { map } from 'rxjs';
import { finalizedHeads } from '@sodazone/ocelloids';

import Connector from '../connector.js';
import { DefaultSubstrateApis } from '../types.js';

export class FinalizedCollector extends EventEmitter {
  #apis: DefaultSubstrateApis;

  constructor(connector: Connector) {
    super();

    this.#apis = connector.connect();
  }

  start() {
    // TODO: save in db and unsubscribe on stop
    this.#apis.chains.map(
      chain => this.#apis.rx[chain].pipe(
        finalizedHeads(),
        map(head => ({
          head,
          chainId: chain
        }))
      ).subscribe({
        next: ({ head, chainId }) => this.emit('head', { chainId, head }),
        error: (error) => console.log('Error on finalized block!!', error)
      })
    );

    // merge(allChainsFinalized)
    //   .pipe(mergeAll())
    //   .subscribe({
    //     next: ({ head, chainId }) => this.emit('head', { chainId, head }),
    //     error: (error) => console.log('Error on finalized block!!', error)
    //   });
  }
}
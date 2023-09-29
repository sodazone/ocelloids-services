import { EventEmitter } from 'node:events';

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
    // TODO all nets...
    this.#apis.rx[1000].pipe(
      finalizedHeads()
    ).subscribe(head => this.emit('head', { chainId: '1000', head }));
  }
}
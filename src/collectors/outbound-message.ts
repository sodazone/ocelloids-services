import { EventEmitter } from 'node:events';

import { Subscription } from 'rxjs';

import Connector from '../connector.js';
import { extractXcmTransfers } from '../ops/index.js';
import { DB, DefaultSubstrateApis, XcmMessageEvent } from '../types.js';
import { ServiceContext } from '../context.js';
import { QuerySubscription } from 'subscriptions/types.js';
import { ControlQuery } from '@sodazone/ocelloids';

type SubscriptionHandler = QuerySubscription & {
  rxSubscription: Subscription,
  sendersControl: ControlQuery
}

export class OutboundMessageCollector extends EventEmitter {
  #apis: DefaultSubstrateApis;
  #ctx: ServiceContext;
  #db: DB;

  #subs: Record<string, SubscriptionHandler> = {};

  constructor(
    ctx: ServiceContext,
    connector: Connector,
    db: DB
  ) {
    super();

    this.#apis = connector.connect();
    this.#db = db;
    this.#ctx = ctx;
  }

  #slqs(origin: string | number) {
    return this.#db.sublevel<string, QuerySubscription>(origin + ':subs', { valueEncoding: 'json'});
  }

  async #recover(origin: string | number) {
    return (await this.#slqs(origin).values()).all();
  }

  monitor(qs: QuerySubscription) {
    const { id, origin, senders } = qs;

    const sendersControl = ControlQuery.from({
      'events.event.section': 'xcmpQueue',
      'events.event.method': 'XcmpMessageSent',
      'block.extrinsics.signer.id': { $in: senders }
    });
    const api = this.#apis.promise[origin];
    const rxSubscription = this.#apis.rx[origin].pipe(
      extractXcmTransfers(api, {
        sendersControl,
        messageCriteria: {
          'recipient': 2000
        }
      })
    ).subscribe(msg => this.emit('message', {
      ...msg,
      chainId: origin
    } as XcmMessageEvent));

    this.#subs[id] = {
      ...qs,
      sendersControl,
      rxSubscription
    };
  }

  subscribe(qs: QuerySubscription) {
    this.#slqs(qs.origin).put(qs.id, qs).then(() => {
      this.monitor(qs);
    });
  }

  async start() {
    const { config: { networks }, log } = this.#ctx;

    for (const network of networks) {
      const subs = await this.#recover(network.id);

      log.info(`Origin subscriptions: [chainId=${network.id}] (${subs.length})`);

      for (const sub of subs) {
        this.monitor(sub);
      }
    }
  }

  stop() {
    const { log } = this.#ctx;

    for (const {
      id, rxSubscription
    } of Object.values(this.#subs)) {
      log.info(`Unsubscribe ${id}`);
      rxSubscription.unsubscribe();
    }
  }
}
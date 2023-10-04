import { EventEmitter } from 'node:events';

import { Subscription, merge, mergeAll } from 'rxjs';

import Connector from '../connector.js';
import { extractXcmReceive, extractXcmTransfers } from '../ops/index.js';
import { DB, DefaultSubstrateApis, XcmMessageEvent } from '../types.js';
import { ServiceContext } from '../context.js';
import { QuerySubscription } from 'subscriptions/types.js';
import { ControlQuery } from '@sodazone/ocelloids';

type SubscriptionHandler = QuerySubscription & {
  rxSubscription: Subscription,
  destinationSubscriptions: Subscription,
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
    const { id, origin, senders, followAllDest, destinations } = qs;

    // Probably can/should be checked at API request
    if (!followAllDest && !destinations) {
      throw new Error('No destinations set');
    }

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
    ).subscribe({
      next: msg => this.emit('message', {
        ...msg,
        chainId: origin
      } as XcmMessageEvent),
      error: error => console.log('ERROR ON ORIGIN NEW BLOCK', error)
    });

    const dests = destinations || this.#apis.chains.filter(c => c !== origin.toString());
    const n = dests
      .map(c => {
        console.log('API', c);
        const chainId = c.toString();
        return this.#apis.rx[chainId].pipe(
          extractXcmReceive(chainId)
        );
      });

    // Don't use merge and keep array of subscriptions
    const destinationSubscriptions = merge(n)
      .pipe(mergeAll())
      .subscribe({
        next: msg => this.emit('receive', {
          ...msg
        }),
        error: error => console.log('ERROR IN DEST NEW BLOCK', error)
      });

    this.#subs[id] = {
      ...qs,
      sendersControl,
      rxSubscription,
      destinationSubscriptions
    };
  }

  subscribe(qs: QuerySubscription) {
    this.#ctx.log.info(`New Subscription: ${qs}`);
    this.#slqs(qs.origin).put(qs.id, qs).then(() => {
      this.monitor(qs);
    });
  }

  unsubscribe(id: string) {
    try {
      const {
        origin, rxSubscription, destinationSubscriptions
      } = this.#subs[id];

      this.#ctx.log.info(`Unsubscribe ${id}`);
      rxSubscription.unsubscribe();
      destinationSubscriptions.unsubscribe();

      this.#ctx.log.info(`Deleting subscription from storage ${id}`);
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      console.log('Subscription ID not found', id);
    }
  }

  listSubscriptions() {
    // TODO: return configurable values too
    return Object.keys(this.#subs);
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
      id, rxSubscription, destinationSubscriptions
    } of Object.values(this.#subs)) {
      log.info(`Unsubscribe ${id}`);
      rxSubscription.unsubscribe();
      destinationSubscriptions.unsubscribe();
    }
  }
}
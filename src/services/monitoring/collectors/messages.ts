import { EventEmitter } from 'node:events';

import { Subscription } from 'rxjs';

import Connector from '../../connector.js';
import { extractXcmReceive, extractXcmTransfers } from './ops/index.js';
import {
  DB, DefaultSubstrateApis, QuerySubscription
} from '../../types.js';
import { XcmMessageEvent } from '../types.js';
import { ServiceContext } from '../../context.js';
import { ControlQuery } from '@sodazone/ocelloids';

type SubscriptionHandler = QuerySubscription & {
  rxSubscription: Subscription,
  destinationSubscriptions: Subscription[],
  sendersControl: ControlQuery
}

export class MessageCollector extends EventEmitter {
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

  // TODO: figure out subscriptions order. If dest fails, origin shouldn't sub
  monitor(qs: QuerySubscription) {
    const { log } = this.#ctx;
    try {
      const { id, origin, senders, destinations } = qs;

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
            'recipient': { $in: destinations }
          }
        })
      ).subscribe({
        next: msg => this.emit('message', {
          ...msg,
          chainId: origin
        } as XcmMessageEvent),
        error: error => log.error(
          `Error on subscription ${id} at origin ${origin}`, error
        )
      });

      const dests = destinations || this.#apis.chains.filter(c => c !== origin.toString());
      const destinationSubscriptions = dests
        .map(c => {
          const chainId = c.toString();
          return this.#apis.rx[chainId].pipe(
            extractXcmReceive(chainId)
          ).subscribe({
            next: msg => this.emit('receive', {
              ...msg
            }),
            error: error => log.error(
              `Error on subscription ${id} at destination ${chainId}`, error
            )
          });
        });

      this.#subs[id] = {
        ...qs,
        sendersControl,
        rxSubscription,
        destinationSubscriptions
      };
    } catch (err) {
      log.error(`Unable to create subscription: ${JSON.stringify(qs, null, 2)}`);
      log.error(err);
    }
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
      destinationSubscriptions.forEach(sub => sub.unsubscribe());

      this.#ctx.log.info(`Deleting subscription from storage ${id}`);
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      this.#ctx.log.error(`Error unsubscribing ${id}`, id);
    }
  }

  async getSubscription(id: string) {
    let subscription: QuerySubscription | undefined;

    for (const network of this.#ctx.config.networks) {
      const subs = await this.#recover(network.id);
      subscription = subs.find(s => s.id === id);
      if (subscription) {
        break;
      }
    }

    return subscription;
  }

  async getSubscriptions() {
    let subscriptions: QuerySubscription[] = [];
    for (const network of this.#ctx.config.networks) {
      const subs = await this.#recover(network.id);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
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
    log.info('Stopping Outbound Message Collector');

    for (const {
      id, rxSubscription, destinationSubscriptions
    } of Object.values(this.#subs)) {
      log.info(`Unsubscribe ${id}`);
      rxSubscription.unsubscribe();
      destinationSubscriptions.forEach(sub => sub.unsubscribe());
    }
  }

  #slqs(origin: string | number) {
    return this.#db.sublevel<string, QuerySubscription>(
      origin + ':subs', { valueEncoding: 'json'}
    );
  }

  async #recover(origin: string | number) {
    return (await this.#slqs(origin).values()).all();
  }
}
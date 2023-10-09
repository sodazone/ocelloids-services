import { EventEmitter } from 'node:events';

import { Subscription } from 'rxjs';
import { SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff } from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { extractXcmReceive, extractXcmSend } from './ops/index.js';
import { DB } from '../../types.js';
import { XcmMessageEvent, QuerySubscription } from '../types.js';
import { ServiceContext } from '../../context.js';
import { NotFound } from '../../../errors.js';
import { HeadCatcher } from './head-catcher.js';

type SubscriptionHandler = QuerySubscription & {
  originSub: Subscription,
  destinationSubs: Subscription[],
  sendersControl: ControlQuery,
  messageControl: ControlQuery
}

/**
 * XCM message collector.
 *
 * Maintains state of the subscriptions in the system and the underlying reactive streams,
 * both for origin and destination networks.
 *
 * Emits XcmMessageEvent events:
 * - 'message' - Emitted when a new XCM message is received.
 * - 'receive' - Emitted when an XCM message is received at the destination network.
 *
 * @see {XcmMessageEvent}
 */
export class MessageCollector extends EventEmitter {
  #apis: SubstrateApis;
  #ctx: ServiceContext;
  #db: DB;

  #subs: Record<string, SubscriptionHandler> = {};
  #cache: HeadCatcher;

  constructor(
    ctx: ServiceContext,
    connector: Connector,
    db: DB,
    cache: HeadCatcher
  ) {
    super();

    this.#apis = connector.connect();
    this.#db = db;
    this.#cache = cache;
    this.#ctx = ctx;
  }

  /**
   * Subscribes according to the given query subscription.
   *
   * @param {QuerySubscription} qs The query subscription.
   * @throws {Error} If there is an error during the subscription setup process.
   */
  async subscribe(qs: QuerySubscription) {
    const { log } = this.#ctx;
    try {
      await this.getSubscription(qs.id);
      throw new Error(`Subscription with ID ${qs.id} already exists`);
    } catch (_) {
    // OK ^^
    }

    log.info(`New Subscription: ${qs}`);

    await this.#slqs(qs.origin).put(qs.id, qs);
    this.#monitor(qs);
  }

  /**
   * Unsubscribes by subsciption identifier.
   *
   * If the subscription does not exists just ignores it.
   *
   * @param {string} id The subscription identifier.
   */
  unsubscribe(id: string) {
    try {
      const {
        origin, originSub, destinationSubs
      } = this.#subs[id];

      this.#ctx.log.info(`Unsubscribe ${id}`);
      originSub.unsubscribe();
      destinationSubs.forEach(sub => sub.unsubscribe());

      this.#ctx.log.info(`Deleting subscription from storage ${id}`);
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      this.#ctx.log.error(`Error unsubscribing ${id}`, id);
    }
  }

  /**
   * Retrieves a subscription by identifier.
   *
   * @param {string} id The subscription identifier
   * @returns {QuerySubscription} the subscription information
   * @throws {NotFound} if the subscription does not exist
   */
  async getSubscription(id: string) {
    // TODO: case if network config changes...
    for (const network of this.#ctx.config.networks) {
      try {
        const subscription = await this.#slqs(network.id).get(id);
        return subscription;
      } catch (error) {
        continue;
      }
    }

    throw new NotFound(`Subscription ${id} not found.`);
  }

  /**
   * Retrieves the registered subscriptions in the database
   * for all the configured networks.
   *
   * @returns {QuerySubscription[]} an array with the subscriptions
   */
  async getSubscriptions() {
    let subscriptions: QuerySubscription[] = [];
    for (const network of this.#ctx.config.networks) {
      const subs = await this.#subsInDB(network.id);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
  }

  /**
   * Starts collecting XCM messages.
   *
   * Monitors all the active subscriptions for the configured networks.
   */
  async start() {
    const { config: { networks }, log } = this.#ctx;

    for (const network of networks) {
      const subs = await this.#subsInDB(network.id);

      log.info(`Origin subscriptions: [chainId=${network.id}] (${subs.length})`);

      for (const sub of subs) {
        try {
          this.#monitor(sub);
        } catch (err) {
          log.error(`Unable to create subscription: ${JSON.stringify(sub, null, 2)}`);
          log.error(err);
        }
      }
    }
  }

  /**
   * Stops the message collectors and unsubscribes from the underlying
   * reactive subscriptions.
   */
  stop() {
    const { log } = this.#ctx;
    log.info('Stopping message collectors');

    for (const {
      id,
      originSub: rxSubscription,
      destinationSubs: destinationSubscriptions
    } of Object.values(this.#subs)) {
      log.info(`Unsubscribe ${id}`);
      rxSubscription.unsubscribe();
      destinationSubscriptions.forEach(sub => sub.unsubscribe());
    }
  }

  /**
   * Main monitoring logic.
   *
   * This method sets up and manages subscriptions for XCM messages based on the provided
   * query subscription information. It creates subscriptions for both the origin and destination
   * networks, monitors XCM message transfers, and emits events accordingly.
   *
   * @param {QuerySubscription} qs - The query subscription.
   * @throws {Error} If there is an error during the subscription setup process.
   * @private
   */
  #monitor(qs: QuerySubscription) {
    const { log } = this.#ctx;
    const { id, origin, senders, destinations } = qs;
    const strOrig = origin.toString();

    // Set up origin subscription

    const sendersControl = ControlQuery.from({
      'events.event.section': 'xcmpQueue',
      'events.event.method': 'XcmpMessageSent',
      'block.extrinsics.signer.id': { $in: senders }
    });

    const messageControl = ControlQuery.from({
      'recipient': { $in: destinations }
    });

    const api = this.#apis.promise[strOrig];
    const originSub = this.#cache.finalizedBlocks(strOrig).pipe(
      extractXcmSend(api, {
        sendersControl,
        messageControl
      }),
      retryWithTruncatedExpBackoff()
    ).subscribe({
      next: msg => this.emit('message', {
        ...msg,
        chainId: origin
      } as XcmMessageEvent),
      error: error => {
        log.error(
          `Error on subscription ${id} at origin ${origin}`
        );
        log.error(error);
      }
    });

    // Set up destination subscriptions

    const dests = destinations || this.#apis.chains.filter(
      c => c !== origin.toString()
    );
    const destinationSubs : Subscription[] = [];

    try {
      dests.forEach(c => {
        const chainId = c.toString();
        destinationSubs.push(this.#cache.finalizedBlocks(chainId).pipe(
          extractXcmReceive(chainId),
          retryWithTruncatedExpBackoff()
        ).subscribe({
          next: msg => this.emit('receive', {
            ...msg
          }),
          error: error => {
            log.error(
              `Error on subscription ${id} at destination ${chainId}`
            );
            log.error(error);
          }
        }));
      });
    } catch (error) {
      // Clean up subscriptions.
      originSub.unsubscribe();
      destinationSubs.forEach(s => {
        s.unsubscribe();
      });

      throw error;
    }

    this.#subs[id] = {
      ...qs,
      sendersControl,
      messageControl,
      originSub,
      destinationSubs
    };
  }

  #slqs(chainId: string | number) {
    return this.#db.sublevel<string, QuerySubscription>(
      chainId + ':subs', { valueEncoding: 'json'}
    );
  }

  async #subsInDB(chainId: string | number) {
    return await this.#slqs(chainId.toString()).values().all();
  }
}
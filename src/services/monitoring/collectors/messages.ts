import { EventEmitter } from 'node:events';

import { Subscription } from 'rxjs';
import {
  SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff, Criteria
} from '@sodazone/ocelloids';

import Connector from '../../connector.js';
import { extractXcmReceive, extractXcmSend } from './ops/index.js';
import { DB } from '../../types.js';
import { XcmMessageSentEvent, QuerySubscription, XcmMessageReceivedEvent } from '../types.js';
import { ServiceContext } from '../../context.js';
import { NotFound } from '../../../errors.js';
import { HeadCatcher } from './head-catcher.js';

type SubscriptionHandler = QuerySubscription & {
  originSub: Subscription,
  destinationSubs: Subscription[],
  sendersControl: ControlQuery,
  messageControl: ControlQuery
}

function sendersCriteria(senders: string[]) : Criteria {
  return {
    'events.event.section': 'xcmpQueue',
    'events.event.method': 'XcmpMessageSent',
    'block.extrinsics.signer.id': { $in: senders }
  };
}

function messageCriteria(recipients: number[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}

export const Outbound = Symbol.for('outbound-message');
export const Inbound = Symbol.for('inbound-message');

/**
 * XCM message collector.
 *
 * Maintains state of the subscriptions in the system and the underlying reactive streams,
 * both for origin and destination networks.
 *
 * Emits 'XcmMessageEvent' events:
 * - Inbound: Emitted when a new XCM message is originated.
 * - Outbound: Emitted when an XCM message is received at the destination network.
 *
 * @see {XcmMessageSentEvent}
 * @see {Inbound}
 * @see {Outbound}
 */
export class MessageCollector extends EventEmitter {
  #apis: SubstrateApis;
  #ctx: ServiceContext;
  #db: DB;

  #subs: Record<string, SubscriptionHandler> = {};
  #catcher: HeadCatcher;

  constructor(
    ctx: ServiceContext,
    connector: Connector,
    db: DB,
    catcher: HeadCatcher
  ) {
    super();

    this.#apis = connector.connect();
    this.#db = db;
    this.#catcher = catcher;
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

    log.info(
      '[%s] new subscription: %s',
      qs.origin,
      qs
    );

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
    const { log } = this.#ctx;
    try {
      const {
        origin, originSub, destinationSubs
      } = this.#subs[id];

      log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSub.unsubscribe();
      destinationSubs.forEach(sub => sub.unsubscribe());
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      log.error(`Error unsubscribing ${id}`, id);
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

      log.info(
        '[%s] number of subscriptions %d',
        network.id,
        subs.length
      );

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
      originSub,
      destinationSubs
    } of Object.values(this.#subs)) {
      log.info(`Unsubscribe ${id}`);
      originSub.unsubscribe();
      destinationSubs.forEach(sub => sub.unsubscribe());
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

    const sendersControl = ControlQuery.from(
      sendersCriteria(senders)
    );
    const messageControl = ControlQuery.from(
      messageCriteria(destinations)
    );

    const api = this.#apis.promise[strOrig];
    const getHrmp = this.#catcher.outboundHrmpMessages(strOrig);
    const originSub = this.#catcher.finalizedBlocks(strOrig).pipe(
      extractXcmSend(
        api,
        {
          sendersControl,
          messageControl
        },
        getHrmp
      ),
      retryWithTruncatedExpBackoff()
    ).subscribe({
      next: message => this.emit(
        Outbound,
        new XcmMessageSentEvent(origin, message)
      ),
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
        destinationSubs.push(this.#catcher.finalizedBlocks(chainId).pipe(
          extractXcmReceive(),
          retryWithTruncatedExpBackoff()
        ).subscribe({
          next: msg => this.emit(
            Inbound,
            new XcmMessageReceivedEvent(chainId, msg)
          ),
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

  /**
   * Updates the senders control handler.
   *
   * Applies to the outbound extrinsic signers.
   */
  updateSenders(id: string, senders: string[]) {
    const { sendersControl } = this.#subs[id];
    sendersControl.change(sendersCriteria(senders));
  }

  /**
   * Updates the message control handler.
   *
   * Applies to the outbound XCM message.
   */
  updateDestinations(id: string, recipients: number[]) {
    const { messageControl } = this.#subs[id];
    messageControl.change(messageCriteria(recipients));
  }

  /**
   * Updates the subscription data in the database.
   */
  async updateInDB(qs: QuerySubscription) {
    const db = await this.#slqs(qs.origin);
    await db.put(qs.id, qs);
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
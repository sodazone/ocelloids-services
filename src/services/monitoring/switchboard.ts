import { FastifyInstance } from 'fastify';

import { Subscription } from 'rxjs';
import {
  SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff
} from '@sodazone/ocelloids';

import Connector from '../connector.js';
import { extractXcmReceive, extractXcmSend } from './ops/xcm.js';
import { DB, Logger } from '../types.js';
import { NotFound } from '../../errors.js';
import { HeadCatcher } from './head-catcher.js';
import {
  XcmMessageSent,
  QuerySubscription,
  XcmMessageReceived,
  XcmMessageNotify,
  SubscriptionHandler
} from './types.js';
import { ServiceConfiguration } from '../configuration.js';
import { MatchingEngine, XcmNotification } from './matching.js';
import { sendersCriteria, messageCriteria } from './ops/criteria.js';

/**
 * XCM Subscriptions Switchboard.
 *
 * Manages subscriptions and notifications for Cross-Consensus Message Format (XCM) formatted messages.
 * Enables subscribing to and unsubscribing from XCM messages of interestm handling 'matched' notifications,
 * and managing subscription lifecycles.
 * Monitors active subscriptions, processes incoming 'matched' notifications,
 * and dynamically updates selection criteria of the subscriptions.
 */
export class Switchboard {
  #connector: Connector;
  #apis: SubstrateApis;
  #config: ServiceConfiguration;
  #log: Logger;
  #db: DB;

  #subs: Record<string, SubscriptionHandler> = {};
  #engine: MatchingEngine;
  #catcher: HeadCatcher;

  constructor(
    ctx: FastifyInstance
  ) {
    const { log , db, config } = ctx;
    const connector = new Connector(log, config);

    this.#connector = connector;
    this.#apis = connector.connect();

    this.#db = db;
    this.#log = log;
    this.#config = config;

    this.#engine = new MatchingEngine(db, log);
    this.#catcher = new HeadCatcher(ctx, connector);
  }

  async onNotification(msg: XcmMessageNotify) {
    // TODO: impl notifier
    try {
      const { subscriptionId } = msg;
      const sub = await this.getSubscription(subscriptionId);
      if (sub.notify.type === 'log') {
        this.#log.info(
          '[%s => %s] NOTIFICATION subscription=%s, messageHash=%s, outcome=%s',
          msg.origin.chainId,
          msg.destination.chainId,
          subscriptionId,
          msg.messageHash,
          msg.outcome
        );
      } else if (sub.notify.type === 'webhook') {
      // TODO impl
      }
    } catch (error) {
      this.#log.error(error, 'Notification type not supported');
    }
  }

  /**
   * Subscribes according to the given query subscription.
   *
   * @param {QuerySubscription} qs The query subscription.
   * @throws {Error} If there is an error during the subscription setup process.
   */
  async subscribe(qs: QuerySubscription) {
    try {
      await this.getSubscription(qs.id);
      throw new Error(`Subscription with ID ${qs.id} already exists`);
    } catch (_) {
    // OK ^^
    }

    this.#log.info(
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
    try {
      const {
        origin, originSub, destinationSubs
      } = this.#subs[id];

      this.#log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSub.unsubscribe();
      destinationSubs.forEach(sub => sub.unsubscribe());
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      this.#log.error(`Error unsubscribing ${id}`, id);
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
    for (const network of this.#config.networks) {
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
    for (const network of this.#config.networks) {
      const subs = await this.#subsInDB(network.id);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
  }

  async start() {
    await this.#startNetworkMonitors();
    this.#engine.on(XcmNotification, this.onNotification.bind(this));
    this.#catcher.start();
  }

  /**
   * Stops the switchboard and unsubscribes from the underlying
   * reactive subscriptions.
   */
  async stop() {
    this.#log.info('Stopping switchboard');

    for (const {
      id,
      originSub,
      destinationSubs
    } of Object.values(this.#subs)) {
      this.#log.info(`Unsubscribe ${id}`);
      originSub.unsubscribe();
      destinationSubs.forEach(sub => sub.unsubscribe());
    }

    this.#catcher.stop();
    await this.#connector.disconnect();
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
    const { id, origin, senders, destinations } = qs;
    const origChainId = origin.toString();

    // Set up origin subscription

    const sendersControl = ControlQuery.from(
      sendersCriteria(senders)
    );
    const messageControl = ControlQuery.from(
      messageCriteria(destinations)
    );

    const api = this.#apis.promise[origChainId];
    const getHrmp = this.#catcher.outboundHrmpMessages(origChainId);

    const originSub = this.#catcher.finalizedBlocks(origChainId)
      .pipe(
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
        next: message => {
          this.#engine.onOutboundMessage(
            new XcmMessageSent(id, origin, message)
          );
        },
        error: error => {
          this.#log.error(
            error,
            'Error on subscription %s at origin %s',
            id, origin
          );
        }
      });

    // Set up destination subscriptions
    const destinationSubs : Subscription[] = [];

    try {
      destinations.forEach(c => {
        const chainId = c.toString();

        destinationSubs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractXcmReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe({
              next: msg => this.#engine.onInboundMessage(
                new XcmMessageReceived(chainId, msg)
              ),
              error: error => {
                this.#log.error(
                  `Error on subscription ${id} at destination ${chainId}`
                );
                this.#log.error(error);
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
   * Starts collecting XCM messages.
   *
   * Monitors all the active subscriptions for the configured networks.
   *
   * @private
   */
  async #startNetworkMonitors() {
    const { networks } = this.#config;

    for (const network of networks) {
      const subs = await this.#subsInDB(network.id);

      this.#log.info(
        '[%s] number of subscriptions %d',
        network.id,
        subs.length
      );

      for (const sub of subs) {
        try {
          this.#monitor(sub);
        } catch (err) {
          this.#log.error(`Unable to create subscription: ${JSON.stringify(sub, null, 2)}`);
          this.#log.error(err);
        }
      }
    }
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
import { FastifyInstance } from 'fastify';

import { Subscription } from 'rxjs';
import {
  SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff
} from '@sodazone/ocelloids';

import Connector from '../connector.js';
import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js';
import { DB, Logger } from '../types.js';
import { NotFound } from '../../errors.js';
import { HeadCatcher } from './head-catcher.js';
import {
  XcmMessageSent,
  QuerySubscription,
  XcmMessageReceived,
  XcmMessageNotify,
  SubscriptionHandler,
  XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from './types.js';
import { ServiceConfiguration, isNetworkDefined, isRelay } from '../configuration.js';
import { MatchingEngine, XcmNotification } from './matching.js';
import { sendersCriteria, messageCriteria } from './ops/criteria.js';
import { extractDmpReceive, extractDmpSend, extractUmpReceive, extractUmpSend } from './ops/vmp.js';
import { Notifier } from './notifier.js';

type Monitor = {
  subs: Subscription[]
  controls: Record<string, ControlQuery>
}

/**
 * XCM Subscriptions Switchboard.
 *
 * Manages subscriptions and notifications for Cross-Consensus Message Format (XCM) formatted messages.
 * Enables subscribing to and unsubscribing from XCM messages of interest, handling 'matched' notifications,
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
  #notifier: Notifier;

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
    this.#notifier = new Notifier(log);
  }

  async onNotification(msg: XcmMessageNotify) {
    const { subscriptionId } = msg;
    const sub = await this.getSubscription(subscriptionId);
    this.#notifier.notify(sub, msg);
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

    this.#validateChainIds([
      qs.origin, ...qs.destinations
    ]);

    this.#log.info(
      '[%s] new subscription: %j',
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
        origin, originSubs, destinationSubs
      } = this.#subs[id];

      this.#log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSubs.forEach(sub => sub.unsubscribe());
      destinationSubs.forEach(sub => sub.unsubscribe());
      delete this.#subs[id];
      this.#slqs(origin).del(id);
    } catch (error) {
      this.#log.error(error, 'Error unsubscribing %s', id);
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
      originSubs,
      destinationSubs
    } of Object.values(this.#subs)) {
      this.#log.info(`Unsubscribe ${id}`);
      originSubs.forEach(sub => sub.unsubscribe());
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
    this.#validateChainIds(recipients);

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
    const { id } = qs;

    let origMonitor : Monitor = { subs: [], controls: {} };
    let destMonitor : Monitor = { subs: [], controls: {} };

    try {
      origMonitor = this.#monitorOrigins(qs);
      destMonitor = this.#monitorDestinations(qs);
    } catch (error) {
      // Clean up origin subscriptions.
      origMonitor.subs.forEach(s => {
        s.unsubscribe();
      });
      throw error;
    }

    const {
      sendersControl, messageControl
    } = origMonitor.controls;

    this.#subs[id] = {
      ...qs,
      sendersControl,
      messageControl,
      originSubs: origMonitor.subs,
      destinationSubs: destMonitor.subs
    };
  }

  #monitorDestinations({
    id, destinations
  }: QuerySubscription) : Monitor {
    const subs : Subscription[] = [];
    try {
      // Set up destination subscriptions
      destinations.forEach(c => {
        const chainId = c.toString();
        const inboundHandler = {
          next: (
            msg: XcmMessageReceivedWithContext
          ) => this.#engine.onInboundMessage(
            new XcmMessageReceived(chainId, msg)
          ),
          error: (error: any) => {
            this.#log.error(
              error,
              'Error on subscription %s at destination %s',
              id,
              chainId
            );
          }
        };

        // D: HRMP / XCMP
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractXcmpReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe(inboundHandler)
        );

        // D: VMP

        // D: DMP
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractDmpReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe(inboundHandler)
        );

        // D: UMP
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractUmpReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe(inboundHandler)
        );
      });
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(s => {
        s.unsubscribe();
      });
      throw error;
    }

    return { subs, controls: {} };
  }

  #monitorOrigins({
    id, origin, senders, destinations
  }: QuerySubscription) : Monitor {
    const subs : Subscription[] = [];
    const origChainId = origin.toString();
    const api = this.#apis.promise[origChainId];

    const sendersControl = ControlQuery.from(
      sendersCriteria(senders)
    );
    const messageControl = ControlQuery.from(
      messageCriteria(destinations)
    );

    // Set up origin subscriptions
    const outboundHandler = {
      next: (msg: XcmMessageSentWithContext) => {
        this.#engine.onOutboundMessage(
          new XcmMessageSent(id, origin, msg)
        );
      },
      error: (error: any) => {
        this.#log.error(
          error,
          'Error on subscription %s at origin %s',
          id, origin
        );
      }
    };

    try {
      // O: VMP
      if (isRelay(this.#config, origin)) {
      // O: DMP
        subs.push(
          this.#catcher.finalizedBlocks(origChainId)
            .pipe(
              extractDmpSend(
                api,
                {
                  sendersControl,
                  messageControl
                }
              )
            ).subscribe(outboundHandler)
        );
      } else {
        // O: UMP
        const getUmp = this.#catcher.outboundUmpMessages(origChainId);
        subs.push(
          this.#catcher.finalizedBlocks(origChainId)
            .pipe(
              extractUmpSend(
                api,
                {
                  sendersControl,
                  messageControl
                },
                getUmp
              )
            ).subscribe(outboundHandler)
        );
      }

      // O: HRMP / XCMP
      const getHrmp = this.#catcher.outboundHrmpMessages(origChainId);
      subs.push(
        this.#catcher.finalizedBlocks(origChainId)
          .pipe(
            extractXcmpSend(
              api,
              {
                sendersControl,
                messageControl
              },
              getHrmp
            ),
            retryWithTruncatedExpBackoff()
          ).subscribe(outboundHandler)
      );
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(s => {
        s.unsubscribe();
      });
      throw error;
    }

    return { subs, controls: {
      sendersControl, messageControl
    }};
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
        '[%s] #subscriptions %d',
        network.id,
        subs.length
      );

      for (const sub of subs) {
        try {
          this.#monitor(sub);
        } catch (err) {
          this.#log.error(
            err,
            'Unable to create subscription: %j',
            sub
          );
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

  #validateChainIds(chainIds: number[]) {
    chainIds.forEach(chainId => {
      if (!isNetworkDefined(this.#config, chainId)) {
        throw new Error('Invalid chain id:' +  chainId);
      }
    });
  }
}
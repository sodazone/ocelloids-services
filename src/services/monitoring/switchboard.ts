import { Subscription } from 'rxjs';
import {
  SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff
} from '@sodazone/ocelloids';

import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js';
import { Logger, Services } from '../types.js';
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

import { ServiceConfiguration, isRelay } from '../configuration.js';
import { MatchingEngine, XcmNotification } from './matching.js';
import { SubsStore } from '../persistence/subs.js';
import { NotifierHub } from '../notification/hub.js';

import { sendersCriteria, messageCriteria } from './ops/criteria.js';
import { extractUmpReceive, extractUmpSend } from './ops/ump.js';
import { extractDmpReceive, extractDmpSend } from './ops/dmp.js';

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
  #apis: SubstrateApis;
  #config: ServiceConfiguration;
  #log: Logger;
  #db: SubsStore;

  #subs: Record<string, SubscriptionHandler> = {};
  #engine: MatchingEngine;
  #catcher: HeadCatcher;
  #notifier: NotifierHub;

  constructor(
    ctx: Services
  ) {
    const {
      log , storage: { subs }, config, connector
    } = ctx;

    this.#apis = connector.connect();

    this.#db = subs;
    this.#log = log;
    this.#config = config;

    this.#engine = new MatchingEngine(ctx);
    this.#catcher = new HeadCatcher(ctx);
    this.#notifier = new NotifierHub(ctx);
  }

  async onNotification(msg: XcmMessageNotify) {
    const { subscriptionId } = msg;
    const sub = await this.#db.getById(subscriptionId);
    this.#notifier.notify(sub, msg);
  }

  /**
   * Subscribes according to the given query subscription.
   *
   * @param {QuerySubscription} qs The query subscription.
   * @throws {Error} If there is an error during the subscription setup process.
   */
  async subscribe(qs: QuerySubscription) {
    await this.#db.insert(qs);
    this.#monitor(qs);

    this.#log.info(
      '[%s] new subscription: %j',
      qs.origin,
      qs
    );
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
        descriptor: { origin }, originSubs, destinationSubs
      } = this.#subs[id];

      this.#log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSubs.forEach(sub => sub.unsubscribe());
      destinationSubs.forEach(sub => sub.unsubscribe());
      delete this.#subs[id];

      this.#db.remove(id);
    } catch (error) {
      this.#log.error(error, 'Error unsubscribing %s', id);
    }
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
  stop() {
    this.#log.info('Stopping switchboard');

    for (const {
      descriptor: { id },
      originSubs,
      destinationSubs
    } of Object.values(this.#subs)) {
      this.#log.info(`Unsubscribe ${id}`);
      originSubs.forEach(sub => sub.unsubscribe());
      destinationSubs.forEach(sub => sub.unsubscribe());
    }

    this.#catcher.stop();
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
   * Updates a subscription descriptor.
   */
  async updateSubscription(sub: QuerySubscription) {
    const { descriptor } = this.#subs[sub.id];
    await this.#db.updateUniquePaths(descriptor, sub);
    this.#subs[sub.id].descriptor = sub;
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
      descriptor: qs,
      sendersControl,
      messageControl,
      originSubs: origMonitor.subs,
      destinationSubs: destMonitor.subs
    };
  }

  /**
   * Set up inbound monitors for XCM protocols.
   *
   * @private
   */
  #monitorDestinations({
    id, destinations, origin
  }: QuerySubscription) : Monitor {
    const subs : Subscription[] = [];
    try {
      destinations.forEach(c => {
        const chainId = c.toString();
        const inboundHandler = {
          next: (
            msg: XcmMessageReceivedWithContext
          ) => this.#engine.onInboundMessage(
            new XcmMessageReceived(id, chainId, msg)
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

        // Inbound HRMP / XCMP transport
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractXcmpReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe(inboundHandler)
        );

        // Inbound VMP
        // DMP
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractDmpReceive(),
              retryWithTruncatedExpBackoff()
            ).subscribe(inboundHandler)
        );
        // UMP
        subs.push(
          this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractUmpReceive(origin),
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

  /**
   * Set up outbound monitors for XCM protocols.
   *
   * @private
   */
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
      // Outbound HRMP / XCMP transport
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

      // Outbound VMP
      if (isRelay(this.#config, origin)) {
        // DMP
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
        // UMP
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
      const subs = await this.#db.getByNetworkId(network.id);

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
}
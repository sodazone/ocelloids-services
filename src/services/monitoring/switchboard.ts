import { Observable, from, map } from 'rxjs';

import {
  SubstrateApis, ControlQuery, retryWithTruncatedExpBackoff
} from '@sodazone/ocelloids';

import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js';
import { Logger, Services, TelemetryObserver, TelemetrySources } from '../types.js';
import { HeadCatcher } from './head-catcher.js';
import {
  XcmSent,
  QuerySubscription,
  XcmReceived,
  XcmMatched,
  SubscriptionHandler,
  XcmReceivedWithContext,
  XcmSentWithContext,
  SubscriptionWithId
} from './types.js';

import { ServiceConfiguration, isRelay } from '../config.js';
import { MatchingEngine } from './matching.js';
import { SubsStore } from '../persistence/subs.js';
import { NotifierHub } from '../notification/hub.js';

import { sendersCriteria, messageCriteria } from './ops/criteria.js';
import { extractUmpReceive, extractUmpSend } from './ops/ump.js';
import { extractDmpReceive, extractDmpSend } from './ops/dmp.js';

type Monitor = {
  subs: SubscriptionWithId[]
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

    this.#engine = new MatchingEngine(ctx, this.#onXcmMatched.bind(this));
    this.#catcher = new HeadCatcher(ctx);
    this.#notifier = new NotifierHub(ctx);
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
  async unsubscribe(id: string) {
    try {
      const {
        descriptor: { origin }, originSubs, destinationSubs
      } = this.#subs[id];

      this.#log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSubs.forEach(({ sub }) => sub.unsubscribe());
      destinationSubs.forEach(({ sub }) => sub.unsubscribe());
      delete this.#subs[id];

      await this.#db.remove(id);
    } catch (error) {
      this.#log.error(error, 'Error unsubscribing %s', id);
    }
  }

  async start() {
    this.#catcher.start();

    await this.#startNetworkMonitors();
  }

  /**
   * Stops the switchboard and unsubscribes from the underlying
   * reactive subscriptions.
   */
  async stop() {
    this.#log.info('Stopping switchboard');

    for (const {
      descriptor: { id },
      originSubs,
      destinationSubs
    } of Object.values(this.#subs)) {
      this.#log.info(`Unsubscribe ${id}`);
      originSubs.forEach(({ sub }) => sub.unsubscribe());
      destinationSubs.forEach(({ sub }) => sub.unsubscribe());
    }

    this.#catcher.stop();
    await this.#engine.stop();
  }

  /**
   * Gets a subscription handler by id.
   */
  getSubscriptionHandler(id: string) {
    return this.#subs[id];
  }

  /**
   * Updates the senders control handler.
   *
   * Applies to the outbound extrinsic signers.
   */
  updateSenders(id: string) {
    const { descriptor: { senders }, sendersControl } = this.#subs[id];

    sendersControl.change(sendersCriteria(senders));
  }

  /**
   * Updates the message control handler.
   *
   * Applies to the outbound XCM message.
   */
  updateDestinations(id: string) {
    const { descriptor, messageControl } = this.#subs[id];

    messageControl.change(messageCriteria(descriptor.destinations));

    const updatedSubs = this.#updateDestinationSubscriptions(id);
    this.#subs[id].destinationSubs = updatedSubs;
  }

  /**
   * Updates a subscription descriptor.
   */
  async updateSubscription(sub: QuerySubscription) {
    const { descriptor } = this.#subs[sub.id];
    await this.#db.updateUniquePaths(descriptor, sub);
    this.#subs[sub.id].descriptor = sub;
  }

  collectTelemetry(collect: (observer: TelemetryObserver) => void) {
    collect({ id: TelemetrySources.engine, source: this.#engine});
    collect({ id: TelemetrySources.catcher, source: this.#catcher});
    collect({ id: TelemetrySources.notifier, source: this.#notifier});
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
      origMonitor.subs.forEach(({ sub }) => {
        sub.unsubscribe();
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
    const subs : SubscriptionWithId[] = [];
    try {
      for (const dest of destinations) {
        const chainId = dest;
        if (this.#subs[id]?.destinationSubs.find(
          s => s.chainId === chainId)
        ) {
          // Skip existing subscriptions
          // for the same destination chain
          continue;
        }

        const inbound$ = () => (
          source: Observable<XcmReceivedWithContext>
        ) => source.pipe(
          map(msg => from(this.#engine.onInboundMessage(
            new XcmReceived(id, chainId, msg)
          )))
        );
        const inboundHandler = {
          error: (error: any) => {
            this.#log.error(
              error,
              'Error on subscription %s at destination %s',
              id,
              chainId
            );
          }
        };

        if (isRelay(this.#config, dest)) {
          // VMP UMP
          this.#log.info(
            '[%s] subscribe inbound UMP (%s)',
            chainId,
            id
          );
          subs.push({
            chainId,
            sub: this.#catcher.finalizedBlocks(chainId)
              .pipe(
                extractUmpReceive(origin),
                retryWithTruncatedExpBackoff(),
                inbound$()
              ).subscribe(inboundHandler)
          });
        } else if (isRelay(this.#config, origin)) {
          // VMP DMP
          this.#log.info(
            '[%s] subscribe inbound DMP (%s)',
            chainId,
            id
          );
          subs.push({
            chainId,
            sub: this.#catcher.finalizedBlocks(chainId)
              .pipe(
                extractDmpReceive(),
                retryWithTruncatedExpBackoff(),
                inbound$()
              ).subscribe(inboundHandler)
          });
        } else {
          // Inbound HRMP / XCMP transport
          this.#log.info(
            '[%s] subscribe inbound HRMP (%s)',
            chainId,
            id
          );
          subs.push({
            chainId,
            sub: this.#catcher.finalizedBlocks(chainId)
              .pipe(
                extractXcmpReceive(),
                retryWithTruncatedExpBackoff(),
                inbound$()
              ).subscribe(inboundHandler)
          });
        }
      }
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(({ sub }) => {
        sub.unsubscribe();
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
    const subs : SubscriptionWithId[] = [];
    const chainId = origin;
    const api = this.#apis.promise[chainId];

    const sendersControl = ControlQuery.from(
      sendersCriteria(senders)
    );
    const messageControl = ControlQuery.from(
      messageCriteria(destinations)
    );

    const outbound$ =  () => (
      source: Observable<XcmSentWithContext>
    ) => source.pipe(
      map(msg => from(this.#engine.onOutboundMessage(
        new XcmSent(id, origin, msg)
      )))
    );
    const outboundHandler = {
      error: (error: any) => {
        this.#log.error(
          error,
          'Error on subscription %s at origin %s',
          id, origin
        );
      }
    };

    try {
      if (isRelay(this.#config, origin)) {
        // VMP DMP
        this.#log.info(
          '[%s] subscribe outbound DMP (%s)',
          chainId,
          id
        );
        subs.push({
          chainId,
          sub: this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractDmpSend(
                api,
                {
                  sendersControl,
                  messageControl
                }
              ),
              retryWithTruncatedExpBackoff(),
              outbound$()
            ).subscribe(outboundHandler)
        });
      } else {
        // Outbound HRMP / XCMP transport
        this.#log.info(
          '[%s] subscribe outbound HRMP (%s)',
          chainId,
          id
        );
        const getHrmp = this.#catcher.outboundHrmpMessages(chainId);
        subs.push({
          chainId,
          sub: this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractXcmpSend(
                {
                  sendersControl,
                  messageControl
                },
                getHrmp
              ),
              retryWithTruncatedExpBackoff(),
              outbound$()
            ).subscribe(outboundHandler)
        });

        // VMP UMP
        this.#log.info(
          '[%s] subscribe outbound UMP (%s)',
          chainId,
          id
        );
        const getUmp = this.#catcher.outboundUmpMessages(chainId);
        subs.push({
          chainId,
          sub: this.#catcher.finalizedBlocks(chainId)
            .pipe(
              extractUmpSend(
                {
                  sendersControl,
                  messageControl
                },
                getUmp
              ),
              retryWithTruncatedExpBackoff(),
              outbound$()
            ).subscribe(outboundHandler)
        });
      }
    } catch (error) {
      // Clean up subscriptions.
      subs.forEach(({ sub }) => {
        sub.unsubscribe();
      });
      throw error;
    }

    return {
      subs,
      controls: {
        sendersControl, messageControl
      }
    };
  }

  #updateDestinationSubscriptions(id: string) {
    const { descriptor, destinationSubs } = this.#subs[id];
    // Subscribe to new destinations, if any
    const { subs } = this.#monitorDestinations(descriptor);
    const updatedSubs = destinationSubs.concat(subs);
    // Unsubscribe removed destinations, if any
    const removed = updatedSubs.filter(s => !descriptor.destinations.includes(s.chainId));
    removed.forEach(({ sub }) => sub.unsubscribe());
    // Return list of updated subscriptions
    return updatedSubs.filter(s => !removed.includes(s));
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

  async #onXcmMatched(msg: XcmMatched) {
    const { subscriptionId } = msg;
    const sub = await this.#db.getById(subscriptionId);
    await this.#notifier.notify(sub, msg);
  }
}
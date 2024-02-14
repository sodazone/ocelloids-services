import EventEmitter from 'node:events';

import { Observable, from, switchMap, share } from 'rxjs';

import {
  SubstrateApis,
  ControlQuery,
  extractEvents,
  retryWithTruncatedExpBackoff,
  types,
  extractTxWithEvents,
  flattenCalls
} from '@sodazone/ocelloids';

import { extractXcmpReceive, extractXcmpSend } from './ops/xcmp.js';
import { Logger, Services } from '../types.js';
import { HeadCatcher } from './head-catcher.js';
import {
  GenericXcmSent,
  QuerySubscription,
  XcmReceived,
  SubscriptionHandler,
  XcmReceivedWithContext,
  XcmSentWithContext,
  SubscriptionWithId,
  XcmEventListener,
  XcmNotifyMessage,
  XcmSent,
  SubscriptionStats
} from './types.js';

import { ServiceConfiguration, isRelay } from '../config.js';
import { MatchingEngine } from './matching.js';
import { SubsStore } from '../persistence/subs.js';
import { NotifierHub } from '../notification/hub.js';
import { NotifierEvents } from '../notification/types.js';
import { TelemetryEventEmitter } from '../telemetry/types.js';

import { sendersCriteria, messageCriteria } from './ops/criteria.js';
import { extractUmpReceive, extractUmpSend } from './ops/ump.js';
import { extractDmpReceive, extractDmpSend, extractDmpSendByEvent } from './ops/dmp.js';
import { extractXcmWaypoints } from './ops/common.js';
import { errorMessage } from '../../errors.js';

type Monitor = {
  subs: SubscriptionWithId[]
  controls: Record<string, ControlQuery>
}

// eslint-disable-next-line no-shadow
export enum SubscribeErrorCodes {
  TOO_MANY_SUBSCRIBERS
}

export class SubscribeError extends Error {
  code: SubscribeErrorCodes;

  constructor(code: SubscribeErrorCodes, message: string) {
    super(message);

    Object.setPrototypeOf(this, SubscribeError.prototype);
    this.code = code;
  }
}

export type SwitchboardOptions = {
  subscriptionMaxPersistent: number,
  subscriptionMaxEphemeral: number
}

const SUB_ERROR_RETRY_MS = 5000;

/**
 * XCM Subscriptions Switchboard.
 *
 * Manages subscriptions and notifications for Cross-Consensus Message Format (XCM) formatted messages.
 * Enables subscribing to and unsubscribing from XCM messages of interest, handling 'matched' notifications,
 * and managing subscription lifecycles.
 * Monitors active subscriptions, processes incoming 'matched' notifications,
 * and dynamically updates selection criteria of the subscriptions.
 */
export class Switchboard extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #apis: SubstrateApis;
  readonly #config: ServiceConfiguration;
  readonly #log: Logger;
  readonly #db: SubsStore;
  readonly #engine: MatchingEngine;
  readonly #catcher: HeadCatcher;
  readonly #notifier: NotifierHub;
  readonly #stats: SubscriptionStats;
  readonly #maxEphemeral: number;
  readonly #maxPersistent: number;

  #subs: Record<string, SubscriptionHandler> = {};
  #shared: {
    blockEvents: Record<string, Observable<types.BlockEvent>>
    blockExtrinsics: Record<string, Observable<types.TxWithIdAndEvent>>
  };

  constructor(
    ctx: Services,
    options: SwitchboardOptions
  ) {
    super();

    const {
      log , storage: { subs }, config, connector
    } = ctx;

    this.#apis = connector.connect();

    this.#db = subs;
    this.#log = log;
    this.#config = config;

    this.#engine = new MatchingEngine(ctx, this.#onXcmWaypointReached.bind(this));
    this.#catcher = new HeadCatcher(ctx);
    this.#notifier = new NotifierHub(ctx);
    this.#stats = {
      ephemeral: 0,
      persistent: 0
    };
    this.#maxEphemeral = options.subscriptionMaxEphemeral;
    this.#maxPersistent = options.subscriptionMaxPersistent;
    this.#shared = {
      blockEvents: {},
      blockExtrinsics: {}
    };
  }

  /**
   * Subscribes according to the given query subscription.
   *
   * @param {QuerySubscription} qs The query subscription.
   * @throws {SubscribeError} If there is an error creating the subscription.
   */
  async subscribe(qs: QuerySubscription) {
    if (this.#stats.ephemeral >= this.#maxEphemeral
      || this.#stats.persistent >= this.#maxPersistent
    ) {
      throw new SubscribeError(
        SubscribeErrorCodes.TOO_MANY_SUBSCRIBERS,
        'too many subscriptions'
      );
    }

    if (!qs.ephemeral) {
      await this.#db.insert(qs);
    }

    this.#monitor(qs);

    this.#log.info(
      '[%s] new subscription: %j',
      qs.origin,
      qs
    );
  }

  /**
   * Adds a listener function to the underlying notifier.
   *
   * @param eventName The notifier event name.
   * @param listener The listener function.
   */
  addNotificationListener(eventName: keyof NotifierEvents, listener: XcmEventListener) {
    this.#notifier.on(eventName, listener);
  }

  /**
   * Removes a listener function from the underlying notifier.
   *
   * @param eventName The notifier event name.
   * @param listener The listener function.
   */
  removeNotificationListener(eventName: keyof NotifierEvents, listener: XcmEventListener) {
    this.#notifier.off(eventName, listener);
  }

  /**
   * Unsubscribes by subsciption identifier.
   *
   * If the subscription does not exists just ignores it.
   *
   * @param {string} id The subscription identifier.
   */
  async unsubscribe(id: string) {
    if (this.#subs[id] === undefined) {
      this.#log.warn('unsubscribe from a non-existent subscription %s', id);
      return;
    }

    try {
      const {
        descriptor: { origin, ephemeral }, originSubs, destinationSubs
      } = this.#subs[id];

      this.#log.info(
        '[%s] unsubscribe %s',
        origin,
        id
      );

      originSubs.forEach(({ sub }) => sub.unsubscribe());
      destinationSubs.forEach(({ sub }) => sub.unsubscribe());
      delete this.#subs[id];

      await this.#engine.clearPendingStates(id);

      if (ephemeral) {
        this.#stats.ephemeral--;
      } else {
        this.#stats.persistent--;
        await this.#db.remove(id);
      }
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
      this.#log.info('Unsubscribe %s', id);

      originSubs.forEach(({ sub }) => sub.unsubscribe());
      destinationSubs.forEach(({ sub }) => sub.unsubscribe());
    }

    this.#catcher.stop();
    await this.#engine.stop();
  }

  /**
   * Gets a subscription handler by id.
   */
  findSubscriptionHandler(id: string) {
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
    if (this.#subs[sub.id]) {
      this.#subs[sub.id].descriptor = sub;
    } else {
      this.#log.warn('trying to update an unknown subscription %s', sub.id);
    }
  }

  /**
   * Calls the given collect function for each private observable component.
   *
   * @param collect The collect callback function.
   */
  collectTelemetry(collect: (observer: TelemetryEventEmitter) => void) {
    collect(this);
    collect(this.#engine);
    collect(this.#catcher);
    collect(this.#notifier);
  }

  /**
   * Returns the in-memory subscription statistics.
   */
  get stats() {
    return this.#stats;
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

    if (qs.ephemeral) {
      this.#stats.ephemeral++;
    } else {
      this.#stats.persistent++;
    }
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

        const emitInbound = () => (
          source: Observable<XcmReceivedWithContext>
        ) => source.pipe(
          switchMap(msg => from(this.#engine.onInboundMessage(
            new XcmReceived(id, chainId, msg)
          )))
        );
        const inboundObserver = {
          error: (error: any) => {
            this.#log.error(
              error,
              '[%s] error on destination subscription %s',
              chainId,
              id
            );
            this.emit('telemetrySubscriptionError', {
              subscriptionId: id, chainId, direction: 'in'
            });

            // try recover inbound subscription
            if (this.#subs[id]) {
              const {destinationSubs} = this.#subs[id];
              const index = destinationSubs.findIndex(s => s.chainId === chainId);
              if (index > -1) {
                destinationSubs.splice(index, 1);
                setTimeout(() => {
                  this.#log.info(
                    '[%s] UPDATE destination subscription %s due error %s',
                    chainId,
                    id,
                    errorMessage(error)
                  );
                  const updated = this.#updateDestinationSubscriptions(id);
                  this.#subs[id].destinationSubs = updated;
                }, SUB_ERROR_RETRY_MS);
              }
            }
          }
        };

        if (isRelay(this.#config, dest)) {
          // VMP UMP
          this.#log.info('[%s] subscribe inbound UMP (%s)', chainId, id);

          subs.push({
            chainId,
            sub: this.#sharedBlockEvents(chainId)
              .pipe(
                extractUmpReceive(origin),
                emitInbound()
              ).subscribe(inboundObserver)
          });
        } else if (isRelay(this.#config, origin)) {
          // VMP DMP
          this.#log.info('[%s] subscribe inbound DMP (%s)', chainId, id);

          subs.push({
            chainId,
            sub: this.#sharedBlockEvents(chainId)
              .pipe(
                extractDmpReceive(),
                emitInbound()
              ).subscribe(inboundObserver)
          });
        } else {
          // Inbound HRMP / XCMP transport
          this.#log.info('[%s] subscribe inbound HRMP (%s)', chainId, id);

          subs.push({
            chainId,
            sub: this.#sharedBlockEvents(chainId)
              .pipe(
                extractXcmpReceive(),
                emitInbound()
              ).subscribe(inboundObserver)
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

    if (this.#subs[id]?.originSubs.find(
      s => s.chainId === chainId)
    ) {
      throw new Error(
        `Fatal: duplicated origin monitor ${id} for chain ${chainId}`
      );
    }

    const sendersControl = ControlQuery.from(
      sendersCriteria(senders)
    );
    const messageControl = ControlQuery.from(
      messageCriteria(destinations)
    );

    const emitOutbound =  () => (
      source: Observable<XcmSentWithContext>
    ) => source.pipe(
      extractXcmWaypoints(),
      switchMap(({ message, stops }) => from(this.#engine.onOutboundMessage(
        new GenericXcmSent(id, origin, message, stops)
      )))
    );
    // TODO: feasible to subscribe next without passing through matching engine?
    // do we want to ensure order of notification?
    const outboundObserver = {
      next: (msg: XcmSent) => {
        this.#onXcmWaypointReached(msg)
      },
      error: (error: any) => {
        this.#log.error(
          error,
          '[%s] error on origin subscription %s',
          chainId, id
        );
        this.emit('telemetrySubscriptionError', {
          subscriptionId: id, chainId, direction: 'out'
        });

        // try recover outbound subscription
        // note: there is a single origin per outbound
        if (this.#subs[id]) {
          const {originSubs, descriptor} = this.#subs[id];
          const index = originSubs.findIndex(s => s.chainId === chainId);
          if (index > -1) {
            this.#subs[id].originSubs = [];
            setTimeout(() => {
              this.#log.info(
                '[%s] UPDATE origin subscription %s due error %s',
                chainId,
                id,
                errorMessage(error)
              );
              const {subs: updated, controls} = this.#monitorOrigins(descriptor);
              this.#subs[id].sendersControl = controls.sendersControl;
              this.#subs[id].messageControl = controls.messageControl;
              this.#subs[id].originSubs = updated;
            }, SUB_ERROR_RETRY_MS);
          }
        }
      }
    };

    try {
      if (isRelay(this.#config, origin)) {
        // VMP DMP
        this.#log.info('[%s] subscribe outbound DMP (%s)', chainId, id);

        subs.push({
          chainId,
          sub: this.#sharedBlockExtrinsics(chainId)
            .pipe(
              extractDmpSend(
                api,
                {
                  sendersControl,
                  messageControl
                }
              ),
              emitOutbound()
            ).subscribe(outboundObserver)
        });

        // VMP DMP
        this.#log.info('[%s] subscribe outbound DMP - by event (%s)', chainId, id);

        subs.push({
          chainId,
          sub: this.#sharedBlockEvents(chainId)
            .pipe(
              extractDmpSendByEvent(
                api,
                {
                  sendersControl,
                  messageControl
                }
              ),
              emitOutbound()
            ).subscribe(outboundObserver)
        });
      } else {
        // Outbound HRMP / XCMP transport
        this.#log.info('[%s] subscribe outbound HRMP (%s)', chainId, id);

        const getHrmp = this.#catcher.outboundHrmpMessages(chainId);
        subs.push({
          chainId,
          sub: this.#sharedBlockEvents(chainId).pipe(
            extractXcmpSend(
              {
                sendersControl,
                messageControl
              },
              getHrmp
            ),
            emitOutbound()
          ).subscribe(outboundObserver)
        });

        // VMP UMP
        this.#log.info('[%s] subscribe outbound UMP (%s)', chainId, id);

        const getUmp = this.#catcher.outboundUmpMessages(chainId);
        subs.push({
          chainId,
          sub: this.#sharedBlockEvents(chainId)
            .pipe(
              extractUmpSend(
                {
                  sendersControl,
                  messageControl
                },
                getUmp
              ),
              retryWithTruncatedExpBackoff(),
              emitOutbound()
            ).subscribe(outboundObserver)
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

  async #onXcmWaypointReached(msg: XcmNotifyMessage) {
    const { subscriptionId } = msg;
    if (this.#subs[subscriptionId]) {
      const { descriptor } = this.#subs[subscriptionId];
      if (descriptor.notificationTypes === '*' || descriptor.notificationTypes.includes(msg.type)) {
        await this.#notifier.notify(descriptor, msg);
      }
    } else {
      // this could happen with closed ephemeral subscriptions
      this.#log.warn(
        'Unable to find descriptor for subscription %s',
        subscriptionId
      );
    }
  }

  #sharedBlockEvents(chainId: string) : Observable<types.BlockEvent> {
    if (!this.#shared.blockEvents[chainId]) {
      this.#shared.blockEvents[chainId] = this.#catcher.finalizedBlocks(chainId)
        .pipe(
          extractEvents(),
          retryWithTruncatedExpBackoff(),
          share()
        );
    }
    return this.#shared.blockEvents[chainId];
  }

  #sharedBlockExtrinsics(chainId: string) : Observable<types.TxWithIdAndEvent> {
    if (!this.#shared.blockExtrinsics[chainId]) {
      this.#shared.blockExtrinsics[chainId] = this.#catcher.finalizedBlocks(chainId)
        .pipe(
          extractTxWithEvents(),
          retryWithTruncatedExpBackoff(),
          flattenCalls(),
          share()
        );
    }
    return this.#shared.blockExtrinsics[chainId];
  }
}
import EventEmitter from 'node:events';

import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import { DB, Logger, Services, jsonEncoded, prefixes } from '../types.js';
import {
  XcmReceived,
  XcmNotifyMessage,
  XcmInbound,
  XcmRelayed,
  XcmRelayedWithContext,
  XcmSent,
  GenericXcmRelayed,
  GenericXcmReceived,
  XcmTimeout,
  GenericXcmTimeout,
  GenericXcmHop,
  XcmHop,
  XcmWaypointContext,
} from './types.js';

import { Janitor, JanitorTask } from '../persistence/janitor.js';
import { TelemetryEventEmitter } from '../telemetry/types.js';

export type XcmMatchedReceiver = (message: XcmNotifyMessage) => Promise<void> | void;
type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string;
  blockHash: string;
  blockNumber: string;
};

const DEFAULT_TIMEOUT = 2 * 60000;
/**
 * Matches sent XCM messages on the destination.
 * It does not assume any ordering.
 *
 * Current matching logic takes into account that messages at origin and destination
 * might or might not have a unique ID set via SetTopic instruction.
 * Therefore, it supports matching logic using both message hash and message ID.
 *
 * When unique message ID is implemented in all XCM events, we can:
 * - simplify logic to match only by message ID
 * - check notification storage by message ID and do not store for matching if already matched
 */
export class MatchingEngine extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger;
  readonly #janitor: Janitor;

  readonly #outbound: SubLevel<XcmSent>;
  readonly #inbound: SubLevel<XcmInbound>;
  readonly #relay: SubLevel<XcmRelayedWithContext>;
  readonly #hop: SubLevel<XcmSent>;
  readonly #mutex: Mutex;
  readonly #xcmMatchedReceiver: XcmMatchedReceiver;

  constructor({ log, storage: { root: db }, janitor }: Services, xcmMatchedReceiver: XcmMatchedReceiver) {
    super();

    this.#log = log;
    this.#janitor = janitor;
    this.#mutex = new Mutex();
    this.#xcmMatchedReceiver = xcmMatchedReceiver;

    // Key format: [subscription-id]:[destination-chain-id]:[message-id/hash]
    this.#outbound = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded);
    // Key format: [subscription-id]:[current-chain-id]:[message-id/hash]
    this.#inbound = db.sublevel<string, XcmInbound>(prefixes.matching.inbound, jsonEncoded);
    // Key format: [subscription-id]:[relay-outbound-chain-id]:[message-id/hash]
    this.#relay = db.sublevel<string, XcmRelayedWithContext>(prefixes.matching.relay, jsonEncoded);
    // Key format: [subscription-id]:[hop-stop-chain-id]:[message-id/hash]
    this.#hop = db.sublevel<string, XcmSent>(prefixes.matching.hop, jsonEncoded);

    this.#janitor.on('sweep', this.#onXcmSwept.bind(this));
  }

  async onOutboundMessage(outMsg: XcmSent) {
    const log = this.#log;

    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = this.#matchingKey(outMsg.subscriptionId, outMsg.destination.chainId, outMsg.waypoint.messageHash);
      // try to get any stored relay messages and notify if found.
      // do not clean up outbound in case inbound has not arrived yet.
      await this.#findRelayInbound(outMsg);

      if (outMsg.messageId) {
        // First try to match by hop key
        // If found, emit hop, and do not store anything
        // If no matching hop key, assume is origin outbound message -> try to match inbound
        // We assume that the original origin message is ALWAYS received first.
        // NOTE: hops can only use idKey since message hash will be different on each hop
        try {
          const hopKey = this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.messageId);
          const originMsg = await this.#hop.get(hopKey);
          log.info(
            '[%s:h] MATCHED HOP OUT origin=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            originMsg.origin.chainId,
            hopKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          );
          // do not delete hop key because maybe hop stop inbound hasn't arrived yet
          this.#onXcmHopOut(originMsg, outMsg);
        } catch {
          this.#onXcmOutbound(outMsg);
          // Try to get stored inbound messages and notify if any
          // If inbound messages are found, clean up outbound.
          // If not found, store outbound message in #outbound to match destination inbound
          // and #hop to match hop outbounds and inbounds.
          // Note: if relay messages arrive after outbound and inbound, it will not match.
          await this.#tryMatchOnOutbound(outMsg);
        }
      } else {
        this.#onXcmOutbound(outMsg);
        // try to get stored inbound messages by message hash and notify if any
        try {
          const inMsg = await this.#inbound.get(hashKey);
          log.info(
            '[%s:o] MATCHED hash=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            hashKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          );
          await this.#inbound.del(hashKey);
          this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:o] STORED hash=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            hashKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          );
          await this.#outbound.put(hashKey, outMsg);
          await this.#janitor.schedule({
            sublevel: prefixes.matching.outbound,
            key: hashKey,
            expiry: DEFAULT_TIMEOUT,
          });
        }
      }
    });

    return outMsg;
  }

  async onInboundMessage(inMsg: XcmInbound) {
    const log = this.#log;

    await this.#mutex.runExclusive(async () => {
      let hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageHash);
      let idKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageId);

      if (hashKey === idKey) {
        try {
          const outMsg = await this.#outbound.get(hashKey);
          log.info(
            '[%s:i] MATCHED hash=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          );
          // If outbound has messageId, we need to reconstruct idKey
          if (outMsg.messageId !== undefined) {
            idKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, outMsg.messageId);
          }
          await this.#outbound.batch().del(idKey).del(hashKey).write();
          this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:i] STORED hash=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          );
          await this.#inbound.put(hashKey, inMsg);
          await this.#janitor.schedule({
            sublevel: prefixes.matching.inbound,
            key: hashKey,
          });
        }
      } else {
        try {
          const outMsg = await Promise.any([this.#outbound.get(idKey), this.#outbound.get(hashKey)]);
          // Reconstruct hashKey with outbound message hash in case of hopped messages
          hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, outMsg.waypoint.messageHash);
          log.info(
            '[%s:i] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            idKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          );
          await this.#outbound.batch().del(idKey).del(hashKey).write();
          this.#onXcmMatched(outMsg, inMsg);
        } catch {
          await this.#tryHopMatchOnInbound(inMsg);
        }
      }
    });
  }

  async onRelayedMessage(subscriptionId: string, relayMsg: XcmRelayedWithContext) {
    const log = this.#log;
    const idKey = relayMsg.messageId
      ? this.#matchingKey(subscriptionId, relayMsg.recipient, relayMsg.messageId)
      : this.#matchingKey(subscriptionId, relayMsg.recipient, relayMsg.messageHash);
    const hopKey = relayMsg.messageId
      ? this.#matchingKey(subscriptionId, '0', relayMsg.messageId)
      : this.#matchingKey(subscriptionId, '0', relayMsg.messageHash);
    await this.#mutex.runExclusive(async () => {
      try {
        const outMsg = await Promise.any([this.#outbound.get(idKey), this.#hop.get(hopKey)]);
        log.info(
          '[%s:r] RELAYED origin=%s recipient=%s (subId=%s, block=%s #%s)',
          '0',
          relayMsg.origin,
          relayMsg.recipient,
          subscriptionId,
          relayMsg.blockHash,
          relayMsg.blockNumber
        );
        await this.#relay.batch().del(idKey).del(hopKey).write();
        await this.#onXcmRelayed(outMsg, relayMsg);
      } catch {
        const relayKey = relayMsg.messageId
          ? this.#matchingKey(subscriptionId, relayMsg.origin, relayMsg.messageId)
          : this.#matchingKey(subscriptionId, relayMsg.origin, relayMsg.messageHash);
        log.info(
          '[%s:r] STORED relayKey=%s origin=%s recipient=%s (subId=%s, block=%s #%s)',
          '0',
          relayKey,
          relayMsg.origin,
          relayMsg.recipient,
          subscriptionId,
          relayMsg.blockHash,
          relayMsg.blockNumber
        );
        await this.#relay.put(relayKey, relayMsg);
        await this.#janitor.schedule({
          sublevel: prefixes.matching.relay,
          key: relayKey,
        });
      }
    });
  }

  // try to find in DB by hop key
  // if found, emit hop, and do not store anything
  // if no matching hop key, assume is destination inbound and store.
  // We assume that the original origin message is ALWAYS received first.
  // NOTE: hops can only use idKey since message hash will be different on each hop
  async #tryHopMatchOnInbound(msg: XcmInbound) {
    if (msg.messageId === undefined) {
      return;
    }

    const log = this.#log;
    try {
      const hopKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageId);
      const originMsg = await this.#hop.get(hopKey);
      log.info(
        '[%s:h] MATCHED HOP IN origin=%s id=%s (subId=%s, block=%s #%s)',
        msg.chainId,
        originMsg.origin.chainId,
        hopKey,
        msg.subscriptionId,
        msg.blockHash,
        msg.blockNumber
      );
      // do not delete hop key because maybe hop stop outbound hasn't arrived yet
      // TO THINK: store in different keys?
      this.#onXcmHopIn(originMsg, msg);
    } catch {
      const hashKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageHash);
      const idKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageId);

      log.info(
        '[%s:i] STORED hash=%s id=%s (subId=%s, block=%s #%s)',
        msg.chainId,
        hashKey,
        idKey,
        msg.subscriptionId,
        msg.blockHash,
        msg.blockNumber
      );
      await this.#inbound.batch().put(idKey, msg).put(hashKey, msg).write();
      await this.#janitor.schedule(
        {
          sublevel: prefixes.matching.inbound,
          key: hashKey,
        },
        {
          sublevel: prefixes.matching.inbound,
          key: idKey,
        }
      );
    }
  }

  // ************* REVIEW ****************
  // Right now we're also storing relay stops in the hop keys, these will never be matched.
  // But unless we enrich legs info we don't know if '0' is a relay or hop stopover.
  // Option 1: emit relay as hops and remove 'relay' concept
  // Option 2: allow potentially unneccessary message to be stored and leave it for janitor to clean up
  // Option 3: enrich legs info or new field stops to know if relay or not...
  async #tryMatchOnOutbound(msg: XcmSent) {
    if (msg.messageId === undefined) {
      return;
    }

    // Still we don't know if the inbound is upgraded,
    // i.e. if uses message ids
    const idKey = this.#matchingKey(msg.subscriptionId, msg.destination.chainId, msg.messageId);
    const hashKey = this.#matchingKey(msg.subscriptionId, msg.destination.chainId, msg.waypoint.messageHash);

    const log = this.#log;
    try {
      const inMsg = await Promise.any([this.#inbound.get(idKey), this.#inbound.get(hashKey)]);

      log.info(
        '[%s:o] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
        msg.origin.chainId,
        hashKey,
        idKey,
        msg.subscriptionId,
        msg.origin.blockHash,
        msg.origin.blockNumber
      );
      await this.#inbound.batch().del(idKey).del(hashKey).write();
      this.#onXcmMatched(msg, inMsg);
    } catch {
      const stops = msg.legs.map((l) => l.to);

      for (const [i, stop] of stops.entries()) {
        const iKey = this.#matchingKey(msg.subscriptionId, stop, msg.messageId);
        const hKey = this.#matchingKey(msg.subscriptionId, stop, msg.waypoint.messageHash);
        if (i === stops.length - 1) {
          log.info(
            '[%s:o] STORED dest=%s hash=%s id=%s (subId=%s, block=%s #%s)',
            msg.origin.chainId,
            stop,
            hKey,
            iKey,
            msg.subscriptionId,
            msg.origin.blockHash,
            msg.origin.blockNumber
          );
          await this.#outbound.batch().put(iKey, msg).put(hKey, msg).write();
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.outbound,
              key: hKey,
              expiry: DEFAULT_TIMEOUT,
            },
            {
              sublevel: prefixes.matching.outbound,
              key: iKey,
              expiry: DEFAULT_TIMEOUT,
            }
          );
        } else {
          log.info(
            '[%s:h] STORED stop=%s hash=%s id=%s (subId=%s, block=%s #%s)',
            msg.origin.chainId,
            stop,
            hKey,
            iKey,
            msg.subscriptionId,
            msg.origin.blockHash,
            msg.origin.blockNumber
          );
          await this.#hop.batch().put(iKey, msg).put(hKey, msg).write();
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.hop,
              key: hKey,
              expiry: DEFAULT_TIMEOUT,
            },
            {
              sublevel: prefixes.matching.hop,
              key: iKey,
              expiry: DEFAULT_TIMEOUT,
            }
          );
        }
      }
    }
  }

  async #findRelayInbound(outMsg: XcmSent) {
    const log = this.#log;
    const relayKey = outMsg.messageId
      ? this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.messageId)
      : this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.waypoint.messageHash);

    try {
      const relayMsg = await this.#relay.get(relayKey);
      log.info(
        '[%s:r] RELAYED key=%s (subId=%s, block=%s #%s)',
        outMsg.origin.chainId,
        relayKey,
        outMsg.subscriptionId,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber
      );
      await this.#relay.del(relayKey);
      await this.#onXcmRelayed(outMsg, relayMsg);
    } catch {
      // noop, it's possible that there are no relay subscriptions for an origin.
    }
  }

  async stop() {
    await this.#mutex.waitForUnlock();
  }

  /**
   * Clears the pending states for a subcription.
   *
   * @param subscriptionId The subscription id.
   */
  async clearPendingStates(subscriptionId: string) {
    const prefix = subscriptionId + ':';
    await this.#clearByPrefix(this.#inbound, prefix);
    await this.#clearByPrefix(this.#outbound, prefix);
    await this.#clearByPrefix(this.#relay, prefix);
    await this.#clearByPrefix(this.#hop, prefix);
  }

  async #clearByPrefix(sublevel: SubLevel<any>, prefix: string) {
    try {
      const batch = sublevel.batch();
      for await (const key of sublevel.keys({ gt: prefix })) {
        if (key.startsWith(prefix)) {
          batch.del(key);
        } else {
          break;
        }
      }
      await batch.write();
    } catch (error) {
      this.#log.error(error, 'while clearing prefix %s', prefix);
    }
  }

  #matchingKey(subscriptionId: string, chainId: string, messageId: string) {
    // We add the subscription id as a discriminator
    // to allow multiple subscriptions to the same messages
    return `${subscriptionId}:${messageId}:${chainId}`;
  }

  #onXcmOutbound(outMsg: XcmSent) {
    this.emit('telemetryOutbound', outMsg);

    try {
      this.#xcmMatchedReceiver(outMsg);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #onXcmMatched(outMsg: XcmSent, inMsg: XcmInbound) {
    this.emit('telemetryMatched', inMsg, outMsg);

    try {
      const message: XcmReceived = new GenericXcmReceived(outMsg, inMsg);
      this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #onXcmRelayed(outMsg: XcmSent, relayMsg: XcmRelayedWithContext) {
    const message: XcmRelayed = new GenericXcmRelayed(outMsg, relayMsg);
    this.emit('telemetryRelayed', message);

    try {
      this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #onXcmHopOut(originMsg: XcmSent, hopMsg: XcmSent) {
    try {
      const { chainId, blockHash, blockNumber, event, outcome, error } = hopMsg.origin;
      const { instructions, messageData, messageHash } = hopMsg.waypoint;
      const currentLeg = hopMsg.legs[0];
      const legIndex = originMsg.legs.findIndex((l) => l.from === currentLeg.from && l.to === currentLeg.to);
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        instructions
      };
      const message: XcmHop = new GenericXcmHop(originMsg, waypointContext, 'out');

      this.emit('telemetryHop', message);

      this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  // NOTE: message data, hash and instructions are right for single hop messages
  // but will be wrong on the second or later hops for multi-hop messages
  // since we are not storing messages or contexts of intermediate hops
  #onXcmHopIn(originMsg: XcmSent, hopMsg: XcmInbound) {
    try {
      const { chainId, blockHash, blockNumber, event, outcome, error } = hopMsg;
      const { messageData, messageHash, instructions } = originMsg.waypoint;
      const legIndex = originMsg.legs.findIndex((l) => l.to === chainId);
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        instructions
      };
      const message: XcmHop = new GenericXcmHop(originMsg, waypointContext, 'in');

      this.emit('telemetryHop', message);

      this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #onXcmSwept(task: JanitorTask, msg: string) {
    try {
      if (task.sublevel === prefixes.matching.outbound) {
        const outMsg = JSON.parse(msg) as XcmSent;
        const message: XcmTimeout = new GenericXcmTimeout(outMsg);
        this.emit('telemetryTimeout', message);
        this.#xcmMatchedReceiver(message);
      }
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }
}

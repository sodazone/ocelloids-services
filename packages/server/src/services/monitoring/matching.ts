import EventEmitter from 'node:events';

import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import {
  DB, Logger, Services, jsonEncoded, prefixes
} from '../types.js';
import {
  XcmReceived,
  XcmNotifyMessage,
  XcmInbound,
  XcmRelayed,
  XcmRelayedWithContext,
  XcmSent
} from './types.js';

import { Janitor } from '../persistence/janitor.js';
import { TelemetryEventEmitter } from '../telemetry/types.js';

export type XcmMatchedReceiver = (message: XcmNotifyMessage) => Promise<void> | void;
type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string,
  blockHash: string,
  blockNumber: string
}

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
  readonly #mutex: Mutex;
  readonly #xcmMatchedReceiver: XcmMatchedReceiver;

  constructor(
    {
      log, storage: { root: db }, janitor
    }: Services,
    xcmMatchedReceiver: XcmMatchedReceiver
  ) {
    super();

    this.#log = log;
    this.#janitor = janitor;
    this.#mutex = new Mutex();
    this.#xcmMatchedReceiver = xcmMatchedReceiver;

    this.#outbound = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded);
    this.#inbound = db.sublevel<string, XcmInbound>(prefixes.matching.inbound, jsonEncoded);
    this.#relay = db.sublevel<string, XcmRelayedWithContext>(prefixes.matching.relay, jsonEncoded);
  }

  async onOutboundMessage(outMsg: XcmSent) {
    const log = this.#log;

    this.emit('telemetryOutbound', outMsg);

    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = this.#matchingKey(outMsg.subscriptionId, outMsg.destination.chainId, outMsg.messageHash);

      if (outMsg.messageId) {
        // Still we don't know if the inbound is upgraded,
        // i.e. if uses message ids
        const idKey = this.#matchingKey(outMsg.subscriptionId, outMsg.destination.chainId, outMsg.messageId);
        // try to get any stored relay messages and notify if found.
        // do not clean up outbound in case inbound has not arrived yet.
        await this.#findRelayInbound(idKey, outMsg);
        // try to get stored inbound messages and notify if any
        // if inbound messages are found, clean up outbound.
        // if relay messages arrive after outbound and inbound, it will not match.
        try {
          const inMsg = await Promise.any([
            this.#inbound.get(idKey),
            this.#inbound.get(hashKey)
          ]);

          log.info(
            '[%s:o] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            hashKey,
            idKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          );
          await this.#inbound.batch()
            .del(idKey)
            .del(hashKey)
            .write();
          await this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:o] STORED hash=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            hashKey,
            idKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          );
          await this.#outbound.batch()
            .put(idKey, outMsg)
            .put(hashKey, outMsg)
            .write();
        }
      } else {
        // try to get any stored relay messages and notify if found.
        // do not clean up outbound in case inbound has not arrived yet.
        await this.#findRelayInbound(hashKey, outMsg);
        // try to get stored inbound messages and notify if any
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
          await this.#onXcmMatched(outMsg, inMsg);
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
        }
      }
    });

    return outMsg;
  }

  async onInboundMessage(inMsg: XcmInbound)  {
    const log = this.#log;

    this.emit('telemetryInbound', inMsg);

    await this.#mutex.runExclusive(async () => {
      const hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageHash);
      const idKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageId);

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
          // TODO: check if should delete idKey as well
          await this.#outbound.del(hashKey);
          await this.#onXcmMatched(outMsg, inMsg);
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
            key: hashKey
          });
        }
      } else {
        try {
          const outMsg = await Promise.any([
            this.#outbound.get(idKey),
            this.#outbound.get(hashKey)
          ]);
          log.info(
            '[%s:i] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            idKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          );
          await this.#outbound.batch()
            .del(idKey)
            .del(hashKey)
            .write();
          await this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:i] STORED hash=%s id=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            idKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          );
          await this.#inbound.batch()
            .put(idKey, inMsg)
            .put(hashKey, inMsg)
            .write();
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.inbound,
              key: hashKey
            },
            {
              sublevel: prefixes.matching.inbound,
              key: idKey
            }
          );
        }
      }
    });
  }

  async onRelayedMessage(id: string, relayMsg: XcmRelayedWithContext) {
    await this.#mutex.runExclusive(async () => {
      if (relayMsg.messageId) {
        // If there is messageId in relay, there must be messageId on outbound
        const idKey = this.#matchingKey(id, relayMsg.recipient, relayMsg.messageId);
        await this.#findRelayOutbound(idKey, id, relayMsg);
      } else {
        const hashKey = this.#matchingKey(id, relayMsg.recipient, relayMsg.messageHash);
        await this.#findRelayOutbound(hashKey, id, relayMsg);
      }
    });
  }

  async #findRelayOutbound(key: string, id: string, relayMsg: XcmRelayedWithContext) {
    const log = this.#log;
    try {
      const outMsg = await this.#outbound.get(key);
      log.info(
        '[%s:r] RELAYED key=%s (subId=%s, block=%s #%s)',
        outMsg.origin.chainId,
        key,
        id,
        relayMsg.blockHash,
        relayMsg.blockNumber
      );
      await this.#relay.del(key);
      await this.#onXcmRelayed(outMsg, relayMsg);
    } catch {
      log.info(
        '[%s:r] STORED key=%s (subId=%s, block=%s #%s)',
        relayMsg.origin,
        key,
        id,
        relayMsg.blockHash,
        relayMsg.blockNumber
      );
      await this.#relay.put(key, relayMsg);
      await this.#janitor.schedule({
        sublevel: prefixes.matching.relay,
        key
      });
    }
  }

  async #findRelayInbound(key: string, outMsg: XcmSent) {
    const log = this.#log;
    try {
      const relayMsg = await this.#relay.get(key);
      log.info(
        '[%s:r] RELAYED key=%s (subId=%s, block=%s #%s)',
        outMsg.origin.chainId,
        key,
        outMsg.subscriptionId,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber
      );
      await this.#relay.del(key);
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
  }

  async #clearByPrefix(sublevel: SubLevel<any>, prefix: string) {
    try {
      const batch = sublevel.batch();
      for await (const key of sublevel.keys({gt: prefix})) {
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

  async #onXcmMatched(
    outMsg: XcmSent,
    inMsg: XcmInbound
  ) {
    this.emit('telemetryMatched', inMsg, outMsg);

    try {
      const message: XcmReceived = new XcmReceived(outMsg, inMsg);
      await this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  async #onXcmRelayed(
    outMsg: XcmSent,
    relayMsg: XcmRelayedWithContext
  ) {
    const message: XcmRelayed = new XcmRelayed(outMsg, relayMsg);
    this.emit('telemetryRelayed', message);

    try {
      await this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }
}
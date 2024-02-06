import EventEmitter from 'node:events';

import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import {
  DB, Logger, Services, jsonEncoded, prefixes
} from '../types.js';
import {
  XcmMatched,
  XcmReceived,
  XcmSent
} from './types.js';

import { Janitor } from '../persistence/janitor.js';
import { TelemetryEventEmitter } from '../telemetry/types.js';

export type XcmMatchedReceiver = (message: XcmMatched) => Promise<void> | void;
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
  #db: DB;
  #log: Logger;
  #janitor: Janitor;

  #outbound: SubLevel<XcmSent>;
  #inbound: SubLevel<XcmReceived>;
  #mutex: Mutex;
  #xcmMatchedReceiver: XcmMatchedReceiver;

  constructor(
    {
      log, storage: { root: db }, janitor
    }: Services,
    xcmMatchedReceiver: XcmMatchedReceiver
  ) {
    super();

    this.#db = db;
    this.#log = log;
    this.#janitor = janitor;
    this.#mutex = new Mutex();
    this.#xcmMatchedReceiver = xcmMatchedReceiver;

    this.#outbound = this.#sl(prefixes.matching.outbound);
    this.#inbound = this.#sl(prefixes.matching.inbound);
  }

  async onOutboundMessage(outMsg: XcmSent) {
    const log = this.#log;

    this.emit('telemetryOutbound', outMsg);

    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = `${outMsg.messageHash}:${outMsg.recipient}`;

      if (outMsg.messageId) {
        // Still we don't know if the inbound is upgraded,
        // i.e. uses message ids
        const idKey = `${outMsg.messageId}:${outMsg.recipient}`;
        try {
          const inMsg = await Promise.any([
            this.#inbound.get(idKey),
            this.#inbound.get(hashKey)
          ]);

          log.info(
            '[%s:o] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.chainId,
            hashKey,
            idKey,
            outMsg.subscriptionId,
            outMsg.blockHash,
            outMsg.blockNumber
          );
          await this.#inbound.batch()
            .del(idKey)
            .del(hashKey)
            .write();
          await this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:o] STORED hash=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.chainId,
            hashKey,
            idKey,
            outMsg.subscriptionId,
            outMsg.blockHash,
            outMsg.blockNumber
          );
          await this.#outbound.batch()
            .put(idKey, outMsg)
            .put(hashKey, outMsg)
            .write();
        }
      } else {
        try {
          const inMsg = await this.#inbound.get(hashKey);
          log.info(
            '[%s:o] MATCHED hash=%s (subId=%s, block=%s #%s)',
            outMsg.chainId,
            hashKey,
            outMsg.subscriptionId,
            outMsg.blockHash,
            outMsg.blockNumber
          );
          await this.#inbound.del(hashKey);
          await this.#onXcmMatched(outMsg, inMsg);
        } catch {
          log.info(
            '[%s:o] STORED hash=%s (subId=%s, block=%s #%s)',
            outMsg.chainId,
            hashKey,
            outMsg.subscriptionId,
            outMsg.blockHash,
            outMsg.blockNumber
          );
          await this.#outbound.put(hashKey, outMsg);
        }
      }
    });
  }

  async onInboundMessage(inMsg: XcmReceived)  {
    const log = this.#log;

    this.emit('telemetryInbound', inMsg);

    await this.#mutex.runExclusive(async () => {
      const hashKey = `${inMsg.messageHash}:${inMsg.chainId}`;
      const idKey = `${inMsg.messageId}:${inMsg.chainId}`;

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

  async stop() {
    await this.#mutex.waitForUnlock();
  }

  async #onXcmMatched(
    outMsg: XcmSent,
    inMsg: XcmReceived
  ) {
    this.emit('telemetryMatched', inMsg, outMsg);

    try {
      const message: XcmMatched = new XcmMatched(outMsg, inMsg);
      await this.#xcmMatchedReceiver(message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, jsonEncoded);
  }
}
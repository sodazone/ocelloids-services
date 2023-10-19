import EventEmitter from 'events';
import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import { DB, Logger, Services } from '../types.js';
import {
  XcmMessageNotify,
  XcmMessageReceived,
  XcmMessageSent
} from './types.js';
import { Janitor } from 'services/storage/janitor.js';

export const XcmNotification = Symbol('xcm-notification');
type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string | number,
  blockHash: string,
  blockNumber: string
}

const sublevelOpts = { valueEncoding: 'json' };

/**
 * Matches sent XCM messages on the destination.
 * It does not assume any ordering.
 */
export class MatchingEngine extends EventEmitter {
  #db: DB;
  #log: Logger;
  #janitor: Janitor;

  #outbound: SubLevel<XcmMessageSent>;
  #inbound: SubLevel<XcmMessageReceived>;
  #mutex: Mutex;

  constructor(
    {
      log, storage: { db }, janitor
    }: Services
  ) {
    super();

    this.#db = db;
    this.#log = log;
    this.#janitor = janitor;
    this.#mutex = new Mutex();

    this.#outbound = this.#sl('out');
    this.#inbound = this.#sl('in');
  }

  async onOutboundMessage(outMsg: XcmMessageSent) {
    const log = this.#log;

    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = `${outMsg.messageHash}:${outMsg.recipient}`;

      if (outMsg.messageId) {
        // Still we don't know if the inbound is upgraded, i.e. uses message ids
        const idKey = `${outMsg.messageId}:${outMsg.recipient}`;
        try {
          const inMsg = await Promise.any([
            this.#inbound.get(idKey),
            this.#inbound.get(hashKey)
          ]);

          log.info(
            '[%s] ✔ MATCHED hash=%s id=%s',
            outMsg.chainId,
            hashKey,
            idKey
          );
          await this.#inbound.batch()
            .del(idKey)
            .del(hashKey)
            .write();
          await this.#notify(outMsg, inMsg);
        } catch {
          log.info(
            '[%s] 🡅 STORED hash=%s id=%s (subId=%s)',
            outMsg.chainId,
            hashKey,
            idKey,
            outMsg.subscriptionId
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
            '[%s] ✔ MATCHED hash=%s',
            outMsg.chainId,
            hashKey
          );
          await this.#inbound.del(hashKey);
          await this.#notify(outMsg, inMsg);
        } catch {
          log.info(
            '[%s] 🡅 STORED hash=%s (subId=%s)',
            outMsg.chainId,
            hashKey,
            outMsg.subscriptionId
          );
          await this.#outbound.put(hashKey, outMsg);
        }
      }
    });
  }

  async onInboundMessage(inMsg: XcmMessageReceived)  {
    const log = this.#log;

    await this.#mutex.runExclusive(async () => {
      const hashKey = `${inMsg.messageHash}:${inMsg.chainId}`;
      const idKey = `${inMsg.messageId}:${inMsg.chainId}`;

      if (hashKey === idKey) {
        try {
          const outMsg = await this.#outbound.get(hashKey);
          log.info(
            '[%s] ✔ MATCHED hash=%s',
            outMsg.chainId,
            hashKey
          );
          await this.#outbound.del(hashKey);
          await this.#notify(outMsg, inMsg);
        } catch {
          log.info(
            '[%s] 🡇 STORED hash=%s',
            inMsg.chainId,
            hashKey
          );
          await this.#inbound.put(hashKey, inMsg);
          await this.#janitor.schedule({
            sublevel: 'in',
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
            '[%s] ✔ MATCHED hash=%s id=%s',
            outMsg.chainId,
            hashKey,
            idKey
          );
          await this.#outbound.batch()
            .del(idKey)
            .del(hashKey)
            .write();
          await this.#notify(outMsg, inMsg);
        } catch {
          log.info(
            '[%s] 🡇 STORED hash=%s id=%s',
            inMsg.chainId,
            hashKey,
            idKey
          );
          await this.#inbound.batch()
            .put(idKey, inMsg)
            .put(hashKey, inMsg)
            .write();
          await this.#janitor.schedule(
            {
              sublevel: 'in',
              key: hashKey
            },
            {
              sublevel: 'in',
              key: idKey
            }
          );
        }
      }
    });
  }

  async #notify(
    outMsg: XcmMessageSent,
    inMsg: XcmMessageReceived
  ) {
    try {
      const message: XcmMessageNotify = new XcmMessageNotify(outMsg, inMsg);
      this.emit(XcmNotification, message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }
}
import EventEmitter from 'events';
import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import { DB, Logger } from '../types.js';
import {
  XcmMessageNotify,
  XcmMessageReceived,
  XcmMessageSent
} from './types.js';

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

  #outbound: SubLevel<XcmMessageSent>;
  #inbound: SubLevel<XcmMessageReceived>;
  #mutex: Mutex;

  constructor(db: DB, log: Logger) {
    super();

    this.#db = db;
    this.#log = log;
    this.#mutex = new Mutex();

    this.#outbound = this.#sl('out');
    this.#inbound = this.#sl('in');
  }

  async onOutboundMessage(outMsg: XcmMessageSent) {
    const log = this.#log;

    // Confirmation key at destination
    const ck = `${outMsg.messageHash}:${outMsg.recipient}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const inMsg = await this.#inbound.get(ck);

        log.info(
          '[%s] MATCHED %s',
          outMsg.chainId,
          ck
        );

        this.#inbound.del(ck);
        await this.#notify(outMsg, inMsg);
      } catch (e) {
        log.info(
          '[%s] STORED FOR MATCHING %s | %s',
          outMsg.chainId,
          ck,
          outMsg.subscriptionId
        );
        await this.#outbound.put(ck, outMsg);
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

  async onInboundMessage(inMsg: XcmMessageReceived)  {
    const log = this.#log;

    const ck = `${inMsg.messageHash}:${inMsg.chainId}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const outMsg = await this.#outbound.get(ck);

        log.info(
          '[%s] MATCHED %s',
          inMsg.chainId,
          ck
        );

        this.#outbound.del(ck);
        await this.#notify(outMsg, inMsg);
      } catch (e) {
        log.info(
          '[%s] STORED FOR MATCHING %s',
          inMsg.chainId,
          ck
        );
        await this.#inbound.put(ck, inMsg);
      }
    });
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }
}
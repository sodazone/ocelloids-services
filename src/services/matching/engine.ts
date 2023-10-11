import pino from 'pino';
import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import { DB } from '../types.js';
import {
  XcmMessageNotify, XcmMessageReceivedEvent, XcmMessageSentEvent
} from 'services/monitoring/types.js';
import EventEmitter from 'events';

type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string | number,
  blockHash: string,
  blockNumber: string
}

export const Notification = Symbol('notification');

const sublevelOpts = { valueEncoding: 'json' };

/**
 * Matches sent XCM messages on the destination.
 * It does not assume any ordering.
 */
export class MatchingEngine extends EventEmitter {
  #db: DB;
  #log: pino.BaseLogger;

  #outbound: SubLevel<XcmMessageSentEvent>;
  #inbound: SubLevel<XcmMessageReceivedEvent>;
  #notifications: SubLevel<any>;
  #mutex: Mutex;

  constructor(db: DB, log: pino.BaseLogger) {
    super();

    this.#db = db;
    this.#log = log;
    this.#mutex = new Mutex();

    this.#outbound = this.#sl('out');
    this.#inbound = this.#sl('in');
    this.#notifications = this.#sl('no');
  }

  async notificationsCount() {
    return (await this.#notifications.keys().all()).length;
  }

  async onOutboundMessage(
    chainBlock: ChainBlock,
    outMsg: XcmMessageSentEvent
  ) {
    const log = this.#log;

    log.info(chainBlock, '[OUT] MESSAGE %s', outMsg.messageHash);

    // Confirmation key at destination
    const ck = `${outMsg.messageHash}:${outMsg.recipient}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const inMsg = await this.#inbound.get(ck);
        log.info('[OUT] NOTIFY %s', ck);
        await this.#notify(ck, outMsg, inMsg);
      } catch (e) {
        log.info('[OUT] CONFIRMED %s', ck);
        await this.#outbound.put(ck, outMsg);
      }
    });
  }

  async #notify(key: string, outMsg: XcmMessageSentEvent, inMsg: XcmMessageReceivedEvent) {
    try {
      const message: XcmMessageNotify = {
        ...outMsg,
        ...inMsg,
        outboundEvent: outMsg.event,
        inboundEvent: inMsg.event
      };
      // TODO when removal?
      await this.#notifications.put(key, message);
      this.emit(Notification, message);
    } catch (e) {
      // TODO
      console.log(e);
    }
  }

  async onInboundMessage(
    chainBlock: ChainBlock,
    inMsg: XcmMessageReceivedEvent
  )  {
    const log = this.#log;
    const { messageHash, outcome } = inMsg;

    log.info(chainBlock, '[IN] MESSAGE %s (Outcome: %s)', messageHash, outcome);

    const ck = `${messageHash}:${chainBlock.chainId}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const outMsg = await this.#outbound.get(ck);
        log.info('[IN] NOTIFY %s', ck);
        await this.#notify(ck, outMsg, inMsg);
      } catch (e) {
        log.info('[IN] CONFIRMED %s', ck);
        await this.#inbound.put(ck, inMsg);
      }
    });
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }
}
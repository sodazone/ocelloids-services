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
  #mutex: Mutex;

  constructor(db: DB, log: pino.BaseLogger) {
    super();

    this.#db = db;
    this.#log = log;
    this.#mutex = new Mutex();

    this.#outbound = this.#sl('out');
    this.#inbound = this.#sl('in');
  }

  async onOutboundMessage(outMsg: XcmMessageSentEvent) {
    const log = this.#log;

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
    // TODO: from class
    try {
      const message: XcmMessageNotify = {
        subscriptionId: outMsg.subscriptionId,
        destination: {
          chainId: inMsg.chainId,
          blockNumber: inMsg.blockNumber,
          blockHash: inMsg.blockHash,
          event: inMsg.event
        },
        origin: {
          chainId: outMsg.chainId,
          blockNumber: outMsg.blockNumber,
          blockHash: outMsg.blockHash,
          event: outMsg.event
        },
        instructions: outMsg.instructions,
        messageData: outMsg.messageData,
        messageHash: inMsg.messageHash,
        outcome: inMsg.outcome,
        error: inMsg.error
      };
      this.emit(Notification, message);
    } catch (e) {
      this.#log.error(e, 'Error on notification');
    }
  }

  async onInboundMessage(inMsg: XcmMessageReceivedEvent)  {
    const log = this.#log;

    const ck = `${inMsg.messageHash}:${inMsg.chainId}`;
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
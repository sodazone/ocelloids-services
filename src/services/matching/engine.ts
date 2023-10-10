import pino from 'pino';
import { AbstractSublevel } from 'abstract-level';
import { Mutex } from 'async-mutex';

import { DB } from '../types.js';
import { XcmMessageReceivedEvent, XcmMessageSentEvent } from 'services/monitoring/types.js';

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
export class MatchingEngine {
  #db: DB;
  #log: pino.BaseLogger;

  #outbound: SubLevel<XcmMessageSentEvent>;
  #inbound: SubLevel<XcmMessageReceivedEvent>;
  #notifications: SubLevel<any>;
  #mutex: Mutex;

  constructor(db: DB, log: pino.BaseLogger) {
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
    message: XcmMessageSentEvent
  ) {
    const log = this.#log;

    log.info(chainBlock, '[OUT] MESSAGE %s', message.messageHash);

    // Confirmation key at destination
    const ck = `${message.messageHash}:${message.recipient}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const conf = await this.#inbound.get(ck);
        // TODO: better merging with toHuman()
        const merged = { ...conf, ...message };
        log.info('[OUT] NOTIFY %s', ck);
        await this.#notify(ck, merged);
      } catch (e) {
        log.info('[OUT] CONFIRMED %s', ck);
        await this.#outbound.put(ck, message);
      }
    });
  }

  // TODO implement
  async #notify(key: string, _message: any) {
    await this.#notifications.put(key, {
      notification: 'here'
    });
  }

  async onInboundMessage(
    chainBlock: ChainBlock,
    message: XcmMessageReceivedEvent
  )  {
    const log = this.#log;
    const { messageHash, outcome } = message;

    log.info(chainBlock, '[IN] MESSAGE %s (Outcome: %s)', messageHash, outcome);

    const ck = `${messageHash}:${chainBlock.chainId}`;
    await this.#mutex.runExclusive(async () => {
      try {
        const conf = await this.#outbound.get(ck);
        log.info('[IN] NOTIFY %s', ck);
        // TODO: better merging with toHuman()
        const merged = { ...conf, ...message };
        await this.#notify(ck, merged);
      } catch (e) {
        log.info('[IN] CONFIRMED %s', ck);
        await this.#inbound.put(ck, message);
      }
    });
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }
}
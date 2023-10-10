import pino from 'pino';
import { AbstractSublevel } from 'abstract-level';

import { DB } from '../types.js';

type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string | number,
  blockHash: string,
  blockNumber: string
}

type Message = {
  messageHash: string
}

type OriginMessage = Message & {
  recipient: string | number
}

const sublevelOpts = { valueEncoding: 'json' };

/**
 * Matches sent XCM messages on the destination.
 * It does not assume any ordering.
 */
export class MatchingEngine {
  #db: DB;
  #log: pino.BaseLogger;

  #confirmations: SubLevel<any>;
  #notifications: SubLevel<any>;

  constructor(db: DB, log: pino.BaseLogger) {
    this.#db = db;
    this.#log = log;

    this.#confirmations = this.#sl('fi');
    this.#notifications = this.#sl('no');
  }

  async notificationsCount() {
    return (await this.#notifications.keys().all()).length;
  }

  async onOutboundMessage(
    chainBlock: ChainBlock,
    message: OriginMessage
  ) {
    const log = this.#log;

    log.info(`[O:MSG] ${JSON.stringify(chainBlock)} to ${JSON.stringify(message)}`);

    // Confirmation key at destination
    const ck = `${message.messageHash}:${message.recipient}`;
    try {
      const conf = await this.#confirmations.get(ck);
      log.info('[O] NOTIFY', conf, message);
      await this.#notify(ck, message);
    } catch (e) {
      log.info(`[O] Confirmed ${ck}`, message);
      await this.#confirmations.put(ck, message);
    }
  }

  // TODO implement
  async #notify(key: string, _message: any) {
    await this.#notifications.put(key, {
      notification: 'here'
    });
  }

  async onInboundMessage(
    chainBlock: ChainBlock,
    message: Message
  )  {
    const log = this.#log;

    log.info(`[I:MSG] ${JSON.stringify(chainBlock)} to ${JSON.stringify(message)}`);

    const ck = `${message.messageHash}:${chainBlock.chainId}`;
    try {
      const conf = await this.#confirmations.get(ck);
      log.info('[I] NOTIFY', conf, message);
      await this.#notify(ck, message);
    } catch (e) {
      log.info(`[I] Confirmed ${ck}`, message);
      await this.#confirmations.put(ck, message);
    }
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }
}
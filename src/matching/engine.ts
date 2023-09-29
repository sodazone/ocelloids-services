import { AbstractSublevel } from 'abstract-level';

import { DB } from '../types.js';

type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>;

export type ChainBlock = {
  chainId: string | number,
  blockHash: string
}

type Message = {
  messageHash: string
}

type OriginMessage = Message & {
  recipient: string | number
}

const sublevelOpts = { valueEncoding: 'json' };

/**
 *
 */
export class MatchingEngine {
  #db: DB;

  #confirmations: SubLevel<any>;
  #notifications: SubLevel<any>;

  constructor(db: DB) {
    this.#db = db;

    this.#confirmations = this.#sl('fi');
    this.#notifications = this.#sl('no');
  }

  async notificationsCount() {
    return (await this.#notifications.keys().all()).length;
  }

  async onFinalizedBlock(chainBlock: ChainBlock) {
    console.log('REC FIN ', chainBlock);
    const orig = this.#slorig(chainBlock);
    const dest = this.#sldest(chainBlock);

    for await (const [k, v] of orig.iterator()) {
      console.log(`[O] Fin ${k}`);

      await orig.del(k);
      const ck = `${v.messageHash}:${v.recipient}`;

      try {
        const conf = await this.#confirmations.get(ck);
        console.log('[O] NOTIFY', conf, v);
        await this.#notifications.put(ck, {
          notification: 'here'
        });
      } catch (e) {
        console.log(`[O] Confirmed ${ck}`, v);
        await this.#confirmations.put(ck, v);
      }
    }

    for await (const [k, v] of dest.iterator()) {
      console.log(`[I] Fin ${k}`);

      await dest.del(k);
      const ck = `${v.messageHash}:${chainBlock.chainId}`;

      try {
        const conf = await this.#confirmations.get(ck);
        console.log('[O] NOTIFY', conf, v);
        await this.#notifications.put(ck, {
          notification: 'here'
        });
      } catch (e) {
        console.log(`[I] Confirmed ${ck}`, v);
        await this.#confirmations.put(ck, v);
      }
    }
  }

  async waitOrigin(
    chainBlock: ChainBlock,
    message: OriginMessage
  ) {
    console.log(`[O:MSG] ${JSON.stringify(chainBlock)} to ${JSON.stringify(message)}`);

    const db = this.#slorig(chainBlock);
    return db.put(message.messageHash, message);
  }

  async waitDestination(
    chainBlock: ChainBlock,
    message: Message
  )  {
    console.log(`[I:MSG] ${JSON.stringify(chainBlock)} to ${JSON.stringify(message)}`);

    const db = this.#sldest(chainBlock);
    return db.put(message.messageHash, message);
  }

  get _db() {
    return this.#db;
  }

  #sl<TV>(prefix: string) {
    return this.#db.sublevel<string, TV>(prefix, sublevelOpts);
  }

  #slorig({chainId, blockHash}: ChainBlock) {
    return this.#sl<OriginMessage>(`O:${chainId}:${blockHash}`);
  }

  #sldest({chainId, blockHash}: ChainBlock) {
    return this.#sl<Message>(`D:${chainId}:${blockHash}`);
  }
}
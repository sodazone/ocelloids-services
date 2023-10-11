import { Subscription, interval } from 'rxjs';
import { DB } from '../../services/types.js';

const DEFAULT_INVERTVAL = 10 * 60 * 1000;

export type JanitorTask = {
  sublevel: string,
  key: string
}

/**
 *
 */
export class Janitor {
  #db: DB;
  #delay: number = 5000; // 5 secs
  #sub?: Subscription;

  constructor(db: DB) {
    this.#db = db;
  }

  start() {
    // TODO: or setInterval?
    this.#sub = interval(DEFAULT_INVERTVAL)
      .subscribe(this.#sweep.bind(this));
  }

  stop() {
    if (this.#sub) {
      this.#sub.unsubscribe();
    }
  }

  async addToClean(task: JanitorTask) {
    await this.#taskDB.put(Date.now() + this.#delay, task);
  }

  get #taskDB() {
    return this.#db.sublevel<number, JanitorTask>(
      'janitor:tasks',
      {valueEncoding: 'json'}
    );
  }

  async #sweep() {
    const db = this.#taskDB;
    const now = Date.now();

    for await (const task of db.values({ lt: now })) {
      console.log('DELE JAN', task);
      await this.#db.sublevel(task.sublevel).del(task.key);
    }
  }
}
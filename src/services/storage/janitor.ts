import { pino } from 'pino';

import { DB } from '../../services/types.js';

export type JanitorTask = {
  sublevel: string,
  key: string
}

export type JanitorOptions = {
  sweepInterval: number;
  sweepExpiry: number;
  janitor: boolean;
};

/**
 * Database clean up tasks.
 */
export class Janitor {
  #log: pino.BaseLogger;
  #db: DB;
  #expiry: number;
  #interval: number;
  #enabled: boolean;
  #intervalId?: NodeJS.Timeout;

  constructor(log: pino.BaseLogger, db: DB, options: JanitorOptions) {
    this.#log = log;
    this.#db = db;
    this.#expiry = options.sweepExpiry;
    this.#interval = options.sweepInterval;
    this.#enabled = options.janitor;
  }

  start() {
    if (this.#enabled) {
      this.#log.info(
        'Starting janitor (interval=%dms, expiry=%dms)',
        this.#interval,
        this.#expiry
      );

      this.#intervalId = setInterval(
        this.#sweep.bind(this),
        this.#interval
      );
    }
  }

  stop() {
    if (this.#intervalId) {
      this.#log.info('Stopping janitor.');

      clearInterval(this.#intervalId);
    }
  }

  async addToClean(...tasks: JanitorTask[]) {
    for (const task of tasks) {
      await this.#taskDB.put(Date.now() + this.#expiry, task);
    }
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

    this.#log.info('Janitor sweep');

    for await (const [key, task] of db.iterator({ lt: now })) {
      await this.#db.sublevel(task.sublevel).del(task.key);
      await db.del(key);
      this.#log.debug(task, 'Janitor swept');
    }
  }
}
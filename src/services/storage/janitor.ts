import { pino } from 'pino';

import { DB } from '../../services/types.js';

export type JanitorTask = {
  sublevel: string,
  key: string,
  expiry?: number
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

  #running: boolean;
  #while: Promise<void> = Promise.resolve();
  #cancel = (_?: unknown) => {};

  constructor(log: pino.BaseLogger, db: DB, options: JanitorOptions) {
    this.#log = log;
    this.#db = db;
    this.#expiry = options.sweepExpiry;
    this.#interval = options.sweepInterval;
    this.#enabled = options.janitor;
    this.#running = false;
  }

  start() {
    if (this.#enabled) {
      this.#log.info(
        'Starting janitor (interval=%dms, expiry=%dms)',
        this.#interval,
        this.#expiry
      );
      this.#while = this.#run();
    }
  }

  async stop() {
    if (this.#running) {
      this.#log.info('Stopping janitor.');
      this.#running = false;
      this.#cancel();
      await this.#while;
    }
  }

  async schedule(...tasks: JanitorTask[]) {
    const batch = this.#taskDB.batch();
    for (const task of tasks) {
      const time = new Date(Date.now() + (task.expiry ?? this.#expiry));
      const key = time.toISOString() + task.sublevel + task.key;
      batch.put(key, task);
    }
    await batch.write();
  }

  async allTaskTimes() {
    return await this.#taskDB.keys().all();
  }

  get #taskDB() {
    return this.#db.sublevel<string, JanitorTask>(
      'janitor:tasks',
      {
        valueEncoding: 'json'
      }
    );
  }

  async #run() {
    const cancellable = new Promise(resolve => {
      this.#cancel = resolve;
    });
    const delay = () => Promise.race([
      new Promise(
        resolve => setTimeout(
          resolve,
          this.#interval
        )
      ),
      cancellable
    ]);

    this.#running = true;

    while (this.#running) {
      await delay();
      try {
        await this.#sweep();
      } catch (error) {
        this.#log.error(error, 'Error while sweeping');
      }
    }
  }

  async #sweep() {
    const tasks = this.#taskDB;
    // We use now for easy tesing
    const now = new Date(Date.now());

    this.#log.info('Janitor sweep');

    const range = tasks.iterator({ lt: now.toISOString() });

    for await (const [key, task] of range) {
      try {
        await this.#db.sublevel(task.sublevel).del(task.key);
        await tasks.del(key);
        this.#log.debug(task, 'Janitor swept');
      } catch (error) {
        this.#log.warn(error, 'Error sweeping %s', key);
      }
    }
  }
}
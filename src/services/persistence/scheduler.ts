import Stream from 'node:stream';

import { DB, Family, Logger } from '../types.js';

export type Scheduled<T = any> = {
  key?: string
  type: string
  task: T
}

export type SchedulerOptions = {
  scheduler: boolean,
  schedFrequency: number
}

export class Scheduler extends Stream.EventEmitter {
  #log: Logger;
  #tasks: Family;
  #frequency: number;
  #enabled: boolean;

  #running: boolean;
  #while: Promise<void> = Promise.resolve();
  #cancel = (_?: unknown) => {};

  constructor(
    log: Logger,
    db: DB,
    opts: SchedulerOptions
  ) {
    super();

    this.#log = log;
    this.#tasks = db.sublevel<string, Scheduled>(
      'sched:tasks',
      { valueEncoding: 'json' }
    );
    this.#enabled = opts.scheduler;
    this.#frequency = opts.schedFrequency;

    this.#running = false;
  }

  start() {
    if (this.#enabled) {
      this.#log.info(
        'Starting scheduler (frequency=%dms)',
        this.#frequency
      );
      this.#while = this.#run();
    }
  }

  async stop() {
    if (this.#running) {
      this.#log.info('Stopping scheduler');
      this.#running = false;
      this.#cancel();
      await this.#while;
    }
  }

  async schedule<T>(...tasks: Scheduled<T>[]) {
    const batch = this.#tasks.batch();
    for (const task of tasks) {
      if (task.key) {
        batch.put(task.key, task);
      }
    }
    await batch.write();
  }

  async allTaskTimes() {
    return await this.#tasks.keys().all();
  }

  async #run() {
    const cancellable = new Promise(resolve => {
      this.#cancel = resolve;
    });
    const delay = () => Promise.race([
      new Promise(
        resolve => setTimeout(
          resolve,
          this.#frequency
        )
      ),
      cancellable
    ]);

    this.#running = true;

    while (this.#running) {
      await delay();
      try {
        await this.#sched();
      } catch (error) {
        this.#log.error(error, 'Error while sweeping');
      }
    }
  }

  async #sched() {
    // We use now for easy tesing
    const now = new Date(Date.now());
    const range = this.#tasks.iterator({ lt: now.toISOString() });

    for await (const [key, task] of range) {
      try {
        if (this.emit(task.type, task)) {
          await this.#tasks.del(key);
          this.#log.debug(task, 'scheduler: Dispateched %s %j', key, task);
        }
      } catch (error) {
        this.#log.warn(error, 'scheduler: Error scheduling %s %j', key, task);
      }
    }
  }
}

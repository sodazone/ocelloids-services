import EventEmitter from 'node:events';

import { Scheduled, Scheduler } from './scheduler.js';
import { DB, Logger, TypedEventEmitter } from '../../services/types.js';

export type JanitorTask = {
  sublevel: string,
  key: string,
  expiry?: number
}

export type JanitorOptions = {
  sweepExpiry: number;
};

const JanitorTaskType = 'task:janitor';

export type JanitorEvents = {
  sweep: (task: JanitorTask, item: string) => void
};

/**
 * Database clean up tasks.
 */
export class Janitor extends (EventEmitter as new () => TypedEventEmitter<JanitorEvents>) {
  #log: Logger;
  #db: DB;
  #sched: Scheduler;
  #expiry: number;

  constructor(
    log: Logger,
    db: DB,
    sched: Scheduler,
    options: JanitorOptions
  ) {
    super();
    this.#log = log;
    this.#db = db;
    this.#expiry = options.sweepExpiry;
    this.#sched = sched;

    this.#sched.on(JanitorTaskType, this.#sweep.bind(this));
  }

  async schedule(...tasks: JanitorTask[]) {
    await this.#sched.schedule<JanitorTask>(...tasks.map(task => {
      const time = new Date(Date.now() + (task.expiry ?? this.#expiry));
      const key = time.toISOString() + task.sublevel + task.key;
      return {
        key,
        type: JanitorTaskType,
        task
      } as Scheduled<JanitorTask>;
    }));
  }

  async #sweep({task}: Scheduled<JanitorTask>) {
    const { sublevel, key } = task;

    try {
      const item = await this.#db.sublevel(sublevel).get(key);
      await this.#db.sublevel(sublevel).del(key);
      this.emit('sweep', task, item);
    } catch {
      //
    }
  }
}
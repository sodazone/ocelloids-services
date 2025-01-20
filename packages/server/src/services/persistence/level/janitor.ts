import EventEmitter from 'node:events'

import { LevelDB, Logger, TypedEventEmitter } from '@/services/types.js'
import { Scheduled, Scheduler } from './scheduler.js'

export type JanitorTask = {
  sublevel: string
  key: string
  expiry?: number
}

export type JanitorOptions = {
  sweepExpiry: number
}

const JanitorTaskType = 'task:janitor'

export type JanitorEvents = {
  sweep: (task: JanitorTask, item: string) => void
}

/**
 * Database clean up tasks.
 */
export class Janitor extends (EventEmitter as new () => TypedEventEmitter<JanitorEvents>) {
  // #log: Logger;
  #db: LevelDB
  #sched: Scheduler
  #expiry: number

  constructor(_log: Logger, db: LevelDB, sched: Scheduler, options: JanitorOptions) {
    super()
    // this.#log = log;
    this.#db = db
    this.#expiry = options.sweepExpiry
    this.#sched = sched

    this.#sched.on(JanitorTaskType, this.#sweep.bind(this))
  }

  async schedule(...tasks: JanitorTask[]) {
    await this.#sched.schedule<JanitorTask>(
      ...tasks.map((task) => {
        const time = new Date(Date.now() + (task.expiry ?? this.#expiry))
        const key = time.toISOString() + task.sublevel + task.key
        return {
          key,
          type: JanitorTaskType,
          task,
        } as Scheduled<JanitorTask>
      }),
    )
  }

  async #sweep({ task }: Scheduled<JanitorTask>) {
    const { sublevel, key } = task
    const db = this.#db.sublevel(sublevel)

    // needed for fake timers
    if (db.status === 'opening') {
      await db.open()
    }

    const item = await db.get(key)
    if (item !== undefined) {
      await db.del(key)
      this.emit('sweep', task, item)
    }
  }
}

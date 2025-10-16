import { EventEmitter } from 'node:events'

import { NotFound } from '@/errors.js'
import { Family, jsonEncoded, LevelDB, Logger, prefixes } from '@/services/types.js'
import { CancelablePromise, delay } from '../persistence/level/delay.js'

export type Scheduled<T = any> = {
  // time based key
  key?: string
  type: string
  task: T
}

export type SchedulerOptions = {
  scheduler: boolean
  schedulerFrequency: number
}

/**
 * Simple database persistent scheduler.
 *
 * This class is designed to schedule tasks with low time resolution, at least minutes.
 * It uses keys with an ISO 8601 UTC formatted date and time for lexicographic ordering.
 */
export class Scheduler extends EventEmitter {
  readonly enabled: boolean

  readonly #log: Logger
  readonly #tasks: Family<string, Scheduled>
  readonly #frequency: number

  #running: boolean
  #waiting?: CancelablePromise<void>
  #while?: Promise<void>

  constructor(log: Logger, db: LevelDB, opts: SchedulerOptions) {
    super()

    this.enabled = opts.scheduler

    this.#log = log
    this.#tasks = db.sublevel<string, Scheduled>(prefixes.sched.tasks, jsonEncoded)
    this.#frequency = opts.schedulerFrequency

    this.#running = false
  }

  start() {
    if (this.enabled) {
      this.#log.info('[scheduler] starting (frequency=%dms)', this.#frequency)
      this.#while = this.#run()
    }
  }

  async stop() {
    if (this.#running) {
      this.#log.info('[scheduler] stopping')

      this.#running = false

      if (this.#waiting) {
        await this.#waiting.cancel()
      }

      if (this.#while) {
        await this.#while
      }

      this.#log.info('[scheduler] stopped')
    }
  }

  async schedule<T>(...tasks: Scheduled<T>[]) {
    const batch = this.#tasks.batch()
    for (const task of tasks) {
      if (task.key) {
        batch.put(task.key, task)
      }
    }
    await batch.write()
  }

  async remove(key: string) {
    await this.#tasks.del(key)
  }

  async allTaskTimes() {
    return await this.#tasks.keys({ limit: 15_000 }).all()
  }

  async getById(key: string) {
    const task = await this.#tasks.get(key)
    if (task === undefined) {
      throw new NotFound(`Task no found for key ${key}`)
    }
    return task
  }

  async hasScheduled(
    predicate: (key: string, task?: Scheduled) => boolean,
    { includeValues = false }: { includeValues?: boolean } = {},
  ): Promise<boolean> {
    const iter = this.#tasks.iterator({
      keys: true,
      values: includeValues,
    })

    try {
      for await (const [key, value] of iter) {
        const task = includeValues ? (value as Scheduled) : undefined
        if (typeof key === 'string' && predicate(key, task)) {
          await iter.close()
          return true
        }
      }
    } finally {
      await iter.close()
    }

    return false
  }

  /**
   * For use with fake timers.
   */
  async __open() {
    await this.#tasks.db.open()
    await this.#tasks.open()
  }

  async #run() {
    this.#running = true

    while (this.#running) {
      this.#waiting = delay(this.#frequency)
      await this.#waiting
      try {
        await this.#sched()
      } catch (error) {
        this.#log.error(error, '[scheduler] error while sweeping')
      }
      await this.#waiting.cancel()
      this.#waiting = undefined
    }
  }

  async #sched() {
    // We use now for easy tesing
    const now = new Date(Date.now())
    const range = this.#tasks.iterator({ lt: now.toISOString() })

    for await (const [key, task] of range) {
      try {
        await this.#tasks.del(key)

        if (this.emit(task.type, task)) {
          this.#log.debug(task, '[scheduler] dispatched %s %j', key, task)
        }
      } catch (error) {
        this.#log.warn(error, '[scheduler] error scheduling %s %j', key, task)
      }
    }
  }
}

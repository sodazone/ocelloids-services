import { EventEmitter } from 'node:events'

import { NotFound } from '@/errors.js'
import { DB, Family, Logger, jsonEncoded, prefixes } from '../types.js'

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
  #log: Logger
  #tasks: Family
  #frequency: number
  #enabled: boolean

  #running: boolean
  #while: Promise<void> = Promise.resolve()
  #cancel = (_?: unknown) => {
    /* empty */
  }

  constructor(log: Logger, db: DB, opts: SchedulerOptions) {
    super()

    this.#log = log
    this.#tasks = db.sublevel<string, Scheduled>(prefixes.sched.tasks, jsonEncoded)
    this.#enabled = opts.scheduler
    this.#frequency = opts.schedulerFrequency

    this.#running = false
  }

  start() {
    if (this.#enabled) {
      this.#log.info('Starting scheduler (frequency=%dms)', this.#frequency)
      this.#while = this.#run()
    }
  }

  async stop() {
    if (this.#running) {
      this.#log.info('Stopping scheduler')
      this.#running = false
      this.#cancel()
      await this.#while
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
    try {
      return await this.#tasks.get(key)
    } catch {
      throw new NotFound('Task no found')
    }
  }

  async #run() {
    const cancellable = new Promise((resolve) => {
      this.#cancel = resolve
    })
    const delay = () =>
      Promise.race([new Promise((resolve) => setTimeout(resolve, this.#frequency)), cancellable])

    this.#running = true

    while (this.#running) {
      await delay()
      try {
        await this.#sched()
      } catch (error) {
        this.#log.error(error, 'Error while sweeping')
      }
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
          this.#log.debug(task, 'scheduler: Dispatched %s %j', key, task)
        }
      } catch (error) {
        this.#log.warn(error, 'scheduler: Error scheduling %s %j', key, task)
      }
    }
  }
}

import { Logger } from '../types.js'
import { ArchiveRepository } from './repository.js'
import { periodToMillis } from './time.js'

export type RetentionPolicy = {
  tickMillis: number
  period: string
}

const id = 'archive:retention'

export class ArchiveRetentionJob {
  readonly #log: Logger
  readonly #policy: RetentionPolicy
  readonly #repository: ArchiveRepository
  #timeout?: NodeJS.Timeout

  constructor(log: Logger, repository: ArchiveRepository, policy: RetentionPolicy) {
    this.#log = log
    this.#policy = policy
    this.#repository = repository
  }

  start() {
    this.#log.info('[%s] %s tick every %s', id, this.#policy.period, this.#policy.tickMillis)
    this.#timeout = setInterval(async () => {
      await this.#onTick()
    }, this.#policy.tickMillis).unref()
  }

  stop() {
    this.#log.info('[%s] stop', id)

    clearInterval(this.#timeout)
  }

  async #onTick() {
    const deleted = await this.#repository.cleanUpOldLogs(periodToMillis(this.#policy.period))

    if (deleted.length > 0) {
      this.#log.info('[%s] deleted %s records', id, deleted.length)
    } else {
      this.#log.info('[%s] no stale records', id)
    }
  }
}

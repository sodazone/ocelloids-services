import { Logger } from '../types.js'
import { ArchiveRepository } from './repository.js'
import { periodToMillis } from './time.js'

export type RetentionPolicy = {
  tickMillis: number
  period: string
}

const id = 'archive:retention'

export class ArchiveRetentionJob {
  _timeout?: NodeJS.Timeout

  readonly #log: Logger
  readonly #policy: RetentionPolicy
  readonly #repository: ArchiveRepository

  constructor(log: Logger, repository: ArchiveRepository, policy: RetentionPolicy) {
    this.#log = log
    this.#policy = policy
    this.#repository = repository
  }

  start() {
    this.#log.info('[%s] %s tick every %sms', id, this.#policy.period, this.#policy.tickMillis)
    this._timeout = setInterval(() => {
      this.#onTick().catch((error) => {
        this.#log.error(error, '[%s] error on tick', id)
      })
    }, this.#policy.tickMillis).unref()
  }

  stop() {
    this.#log.info('[%s] stop', id)

    clearInterval(this._timeout)
  }

  async #onTick() {
    const deleted = await this.#repository.cleanUpOldLogs(periodToMillis(this.#policy.period))

    if (deleted.length > 0) {
      this.#log.info('[%s] deleted %s records', id, Number(deleted[0].numDeletedRows))
    } else {
      this.#log.warn('[%s] missing delete results', id)
    }
  }
}

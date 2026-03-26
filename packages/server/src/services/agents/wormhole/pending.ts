import { toStatus } from '@/services/networking/apis/wormhole/status.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { Logger } from '@/services/types.js'
import { FullJourney, JourneyStatus } from '../crosschain/index.js'

const FINAL_STATUS: JourneyStatus[] = ['received', 'timeout', 'failed', 'unknown']
const HOUR = 3_600_000
const HOURS_6 = 6 * HOUR
const HOURS_24 = 24 * HOUR
const HOURS_72 = 72 * HOUR
const DAYS_7 = 604_800_000

type PendingJourney = {
  journey: FullJourney

  attempt: number
  nextCheckAt: number
  lastCheckedAt?: number

  firstSeenAt: number
}

export class WormholePendingCache {
  readonly #pendingOps = new Map<string, PendingJourney>()
  readonly #log: Logger

  #lastCheckedAt: number | null = null

  constructor(log: Logger) {
    this.#log = log
  }

  get size(): number {
    return this.#pendingOps.size
  }

  get lastCheckedAt(): number | null {
    return this.#lastCheckedAt
  }

  add(journeys: FullJourney[]) {
    let added = 0
    for (const journey of journeys) {
      if (this.#pendingOps.has(journey.correlation_id)) {
        continue
      }

      added++

      this.#pendingOps.set(journey.correlation_id, {
        journey,
        attempt: 0,
        firstSeenAt: Date.now(),
        nextCheckAt: Date.now(),
      })
    }
    this.#lastCheckedAt = Date.now()

    this.#log.info(
      '[agent:wormhole:cache] Added %s new pending items, total items: %s',
      added,
      this.#pendingOps.size,
    )
  }

  update(journey: FullJourney, op?: WormholeOperation | null) {
    const jid = journey.correlation_id
    const entry = this.#pendingOps.get(jid)
    if (!entry || journey.sent_at === undefined) {
      return
    }

    const sentAt = Number(journey.sent_at)
    const isReceived = op ? FINAL_STATUS.includes(toStatus(op)) : false
    const isTimeout = Date.now() - sentAt > DAYS_7

    if (isReceived || isTimeout) {
      this.#pendingOps.delete(jid)
      this.#log.info(
        '[agent:wormhole:cache] Deleted item %s (isReceived=%s, isTimeout=%s)',
        jid,
        isReceived,
        isTimeout,
      )
      return
    }

    entry.nextCheckAt = this.#computeNextCheck(sentAt)
    entry.lastCheckedAt = Date.now()
    entry.attempt++

    this.#log.info(
      '[agent:wormhole:cache] %s next check at: %s',
      jid,
      new Date(entry.nextCheckAt).toISOString(),
    )
  }

  getDue(now = Date.now()): PendingJourney[] {
    return Array.from(this.#pendingOps.values()).filter((op) => op.nextCheckAt <= now)
  }

  #computeNextCheck(sentAt: number): number {
    const age = Date.now() - sentAt
    if (age <= HOURS_24) {
      return Date.now() + 899_000
    }
    if (age <= HOURS_72) {
      return Date.now() + HOUR
    }
    return Date.now() + HOURS_6
  }
}

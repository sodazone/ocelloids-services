import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { LevelDB, Logger } from '@/services/types.js'
import { Subscription } from 'rxjs'
import { StewardManagerContext } from '../types.js'
import { mappers } from './mappers/index.js'
import { BalanceUpdateJob } from './types.js'

export class BalancesManager {
  id = 'steward:balances'

  readonly #log: Logger
  readonly #substrateIngress: SubstrateIngressConsumer

  readonly #dbBalances: LevelDB<Buffer, Buffer>

  readonly #rxSubs: Subscription[] = []

  readonly #jobMap: Map<string, BalanceUpdateJob> = new Map()
  #running = false

  constructor({ log, openLevelDB, ingress }: StewardManagerContext) {
    this.#log = log
    this.#substrateIngress = ingress.substrate
    this.#dbBalances = openLevelDB('steward:balances', { valueEncoding: 'buffer', keyEncoding: 'buffer' })
  }

  async start() {
    // start subscriptions
    this.#running = true
    this.#processQueue()
    this.#subscribeBalancesEvents()
  }

  async stop() {
    this.#running = false
    for (const sub of this.#rxSubs) {
      sub.unsubscribe()
    }
    await this.#dbBalances.close()
  }

  // Will open SSE stream, maybe rename
  // queries(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
  //   throw new Error('Not implemented')
  // }

  #subscribeBalancesEvents() {
    const chainIds = this.#substrateIngress.getChainIds()

    for (const chainId of chainIds) {
      if (this.#substrateIngress.isNetworkDefined(chainId)) {
        const balancesSubMappers = mappers[chainId]
        if (balancesSubMappers) {
          this.#log.info('[agent:%s] watching for balances updates %s', this.id, chainId)
          this.#rxSubs.push(...balancesSubMappers(chainId, this.#substrateIngress, this.enqueue.bind(this)))
        }
      }
    }
  }

  /**
   * Adds or replaces a balance update job for a specific key.
   */
  enqueue(key: string, job: BalanceUpdateJob) {
    if (this.#jobMap.has(key)) {
      return
    }
    this.#jobMap.set(key, job)
  }

  // process in parallel
  async #processQueue() {
    while (this.#running) {
      if (this.#jobMap.size === 0) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      // grab one entry
      const [key, job] = this.#jobMap.entries().next().value as [string, BalanceUpdateJob]
      this.#jobMap.delete(key)
      console.log('Queue size:', this.#jobMap.size)

      try {
        await job()
      } catch (err) {
        this.#log.error(err, '[%s] failed balance update for %s', this.id, key)
      }
    }
  }
}

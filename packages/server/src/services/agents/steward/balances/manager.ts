import { HexString } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { BatchOperation, LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { Subscription, firstValueFrom } from 'rxjs'
import { StewardManagerContext } from '../types.js'
import { createBalancesCodec } from './codec.js'
import { balanceEventsSubscriptions, balanceExtractorMappers } from './mappers/index.js'
import { BalanceQueueData } from './types.js'

const balancesCodec = createBalancesCodec()

function epochSecondsNow() {
  return Math.trunc(Date.now() / 1_000)
}

export class BalancesManager {
  id = 'steward:balances'

  readonly #log: Logger
  readonly #substrateIngress: SubstrateIngressConsumer

  readonly #dbBalances: LevelDB<Buffer, Buffer>

  readonly #rxSubs: Subscription[] = []

  readonly #balanceUpdateQueue: Record<NetworkURN, Map<HexString, BalanceQueueData>> = {}
  readonly #balanceDiscoveryQueue: Set<HexString> = new Set()
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
        const balancesSubMappers = balanceEventsSubscriptions[chainId]
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
  enqueue(chainId: NetworkURN, key: HexString, data: BalanceQueueData) {
    const jobs = (this.#balanceUpdateQueue[chainId] ??= new Map<HexString, BalanceQueueData>())

    if (!jobs.has(key)) {
      jobs.set(key, data)
    }
  }

  async #processQueue() {
    while (this.#running) {
      // if all job maps are empty, wait
      const hasItems = Object.values(this.#balanceUpdateQueue).some((map) => map.size > 0)
      if (!hasItems) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      for (const [chainId, queue] of Object.entries(this.#balanceUpdateQueue) as [
        NetworkURN,
        Map<HexString, BalanceQueueData>,
      ][]) {
        if (queue.size === 0) {
          continue
        }

        // TODO: upper limit for number of keys
        const storageKeys = Array.from(queue.keys())
        console.log('FETCHING ---', chainId, storageKeys.length)

        try {
          const changesSets = await firstValueFrom(
            this.#substrateIngress.queryStorageAt(chainId, storageKeys),
          )

          const ops: BatchOperation<Buffer, Buffer>[] = []

          for (const [storageKey, data] of queue.entries()) {
            const { module, name, account, assetKeyHash } = data
            // find account in db by prefix??
            // if not exist, add to discovery queue
            const changeSet = changesSets[0]?.changes.find(([key]) => key === storageKey)
            const rawValue = changeSet ? changeSet[1] : null

            const dbKey = balancesCodec.key.enc(account, assetKeyHash)

            if (rawValue !== null) {
              const codec = (await firstValueFrom(this.#substrateIngress.getContext(chainId))).storageCodec(
                module,
                name,
              )
              const decodedValue = codec.value.dec(rawValue)
              const balanceExtractor = balanceExtractorMappers[`${module}.${name}`]
              if (balanceExtractor) {
                const balance = balanceExtractor(decodedValue)
                const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())

                ops.push({ type: 'put', key: dbKey, value: dbValue })
              }
            } else {
              ops.push({ type: 'del', key: dbKey })
            }

            queue.delete(storageKey)
          }

          if (ops.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            // await this.#dbBalances.batch(ops)
          }
        } catch (err) {
          this.#log.error(err, '[%s] failed processing queue for network %s', this.id, chainId)
        }
      }
    }
  }
}

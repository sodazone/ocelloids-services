import { asPublicKey } from '@/common/util.js'
import { HexString, QueryPagination, QueryParams, QueryResult } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { BatchOperation, LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { toHex } from 'polkadot-api/utils'
import { Subscription, firstValueFrom } from 'rxjs'
import { AssetMetadata, StewardManagerContext, StewardQueryArgs } from '../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../util.js'
import { createBalancesCodec, normaliseAddress } from './codec.js'
import { balanceEventsSubscriptions, balanceExtractorMappers, storageKeyMappers } from './mappers/index.js'
import { BalancesQueueData } from './types.js'

const DISCO_MARKER_BYTE = Buffer.from([0xff])
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

  readonly #balanceUpdateQueue: Record<NetworkURN, Map<HexString, BalancesQueueData>> = {}
  readonly #balanceDiscoveryQueue = new Set<string>()
  readonly #balanceDiscoveryInProgress = new Set<string>()

  readonly #queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>

  #running = false

  constructor(
    { log, openLevelDB, ingress }: StewardManagerContext,
    queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>,
  ) {
    this.#log = log
    this.#substrateIngress = ingress.substrate
    this.#queries = queries
    this.#dbBalances = openLevelDB('steward:balances', { valueEncoding: 'buffer', keyEncoding: 'buffer' })
  }

  async start() {
    // start subscriptions
    this.#running = true
    this.#subscribeBalancesEvents()
    this.#processUpdateQueue()
    this.#processDiscoveryQueue()
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
          this.#rxSubs.push(...balancesSubMappers(this.#substrateIngress, this.enqueue.bind(this)))
        }
      }
    }
  }

  enqueue(chainId: NetworkURN, key: HexString, data: BalancesQueueData) {
    const queue = (this.#balanceUpdateQueue[chainId] ??= new Map<HexString, BalancesQueueData>())

    if (!queue.has(key)) {
      queue.set(key, data)
    }
  }

  async #processUpdateQueue() {
    while (this.#running) {
      // if all update queues are empty, wait
      const hasItems = Object.values(this.#balanceUpdateQueue).some((map) => map.size > 0)
      if (!hasItems) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      for (const [chainId, queue] of Object.entries(this.#balanceUpdateQueue) as [
        NetworkURN,
        Map<HexString, BalancesQueueData>,
      ][]) {
        if (queue.size === 0) {
          continue
        }

        // TODO: upper limit for number of keys
        const storageKeys = Array.from(queue.keys())

        try {
          const ops: BatchOperation<Buffer, Buffer>[] = []

          for (const [storageKey, data] of queue.entries()) {
            const { module, name, account, publicKey, assetKeyHash } = data
            const dbKey = balancesCodec.key.enc(publicKey, assetKeyHash)

            const shouldBeDiscovered = await this.#shouldBeDiscovered({ account, publicKey })
            if (shouldBeDiscovered) {
              this.#balanceDiscoveryQueue.add(account)
            }

            const changesSets = await firstValueFrom(
              this.#substrateIngress.queryStorageAt(chainId, storageKeys),
            )
            const changeSet = changesSets[0]?.changes.find(([key]) => key === storageKey)
            const rawValue = changeSet ? changeSet[1] : null

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
            await this.#dbBalances.batch(ops)
          }
        } catch (err) {
          this.#log.error(err, '[%s] failed processing queue for network %s', this.id, chainId)
        }
      }
    }
  }

  async #processDiscoveryQueue() {
    while (this.#running) {
      if (this.#balanceDiscoveryQueue.size === 0) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      const account = this.#balanceDiscoveryQueue.values().next().value as HexString
      this.#balanceDiscoveryQueue.delete(account)

      if (this.#balanceDiscoveryInProgress.has(account)) {
        continue
      }

      this.#balanceDiscoveryInProgress.add(account)

      try {
        const chainIds = this.#substrateIngress.getChainIds()

        for (const chainId of chainIds) {
          if (!this.#substrateIngress.isNetworkDefined(chainId)) {
            continue
          }

          const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))

          await this.#discoverBalances(chainId, account, apiCtx, { limit: 100 })
        }
        this.#markDiscovered(account)
      } catch (err) {
        this.#log.error(err, '[%s] failed processing discovery for account %s', this.id, account)
      } finally {
        this.#balanceDiscoveryInProgress.delete(account)
      }
    }
  }

  async #discoverBalances(
    chainId: NetworkURN,
    account: string,
    apiCtx: SubstrateApiContext,
    pagination?: QueryPagination,
  ): Promise<void> {
    const storageKeyMapper = storageKeyMappers[chainId]
    if (!storageKeyMapper) {
      this.#log.warn('[%s] no storage key mapper defined for chain %s', this.id, chainId)
      return
    }

    const { items, pageInfo } = (await this.#queries({
      args: {
        op: 'assets.list',
        criteria: { network: chainId },
      },
      pagination,
    })) as QueryResult<AssetMetadata>

    if (!items || items.length === 0) {
      return
    }

    const storageItems = items
      .map(({ id }) => {
        const mapped = storageKeyMapper(id, account, apiCtx)
        if (mapped === null) {
          return null
        }
        return {
          ...mapped,
          assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, id))) as HexString,
        }
      })
      .filter((i) => i !== null)

    const storageKeys = storageItems.map((i) => i.storageKey)

    try {
      const changeSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, storageKeys))
      const ops: BatchOperation<Buffer, Buffer>[] = []

      for (const { module, name, storageKey, assetKeyHash } of storageItems) {
        const changeSet = changeSets[0]?.changes.find(([key]) => key === storageKey)
        const rawValue = changeSet ? changeSet[1] : null

        const dbKey = balancesCodec.key.enc(asPublicKey(account), assetKeyHash)

        if (rawValue !== null) {
          const codec = apiCtx.storageCodec(module, name)
          const decodedValue = codec.value.dec(rawValue)

          const balanceExtractor = balanceExtractorMappers[`${module}.${name}`]
          if (balanceExtractor) {
            const balance = balanceExtractor(decodedValue)
            const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())
            ops.push({ type: 'put', key: dbKey, value: dbValue })
          }
        }
      }

      if (ops.length > 0) {
        await this.#dbBalances.batch(ops)
      }
    } catch (err) {
      this.#log.error(err, '[%s] failed fetching balances for account %s on %s', this.id, account, chainId)
    }

    if (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
      // short delay to avoid hogging the event loop
      await new Promise((r) => setTimeout(r, 50))
      await this.#discoverBalances(chainId, account, apiCtx, {
        ...pagination,
        cursor: pageInfo.endCursor,
      })
    }
  }

  async #shouldBeDiscovered({
    publicKey,
    account,
  }: { publicKey: HexString; account: string }): Promise<boolean> {
    return !this.#balanceDiscoveryInProgress.has(account) && !(await this.#hasBeenDiscovered(publicKey))
  }

  async #markDiscovered(account: string): Promise<void> {
    const key = Buffer.concat([DISCO_MARKER_BYTE, normaliseAddress(asPublicKey(account))])
    // store timestamp instead of 1 if you want
    await this.#dbBalances.put(key, Buffer.from([1]))
  }

  async #hasBeenDiscovered(publicKey: HexString): Promise<boolean> {
    const addrBuf = normaliseAddress(publicKey)
    const markerKey = Buffer.concat([DISCO_MARKER_BYTE, addrBuf])
    try {
      return (await this.#dbBalances.get(markerKey)) !== undefined
    } catch {
      return false
    }
  }
}

import { asPublicKey } from '@/common/util.js'
import { HexString, QueryPagination, QueryParams, QueryResult } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { BatchOperation, LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { toHex } from 'polkadot-api/utils'
import { Subscription, firstValueFrom } from 'rxjs'
import { ServerSideEventsBroadcaster, ServerSideEventsRequest } from '../../types.js'
import {
  AssetMetadata,
  StewardManagerContext,
  StewardQueryArgs,
  StewardServerSideEventArgs,
} from '../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../util.js'
import { createBalancesCodec, normaliseAddress } from './codec.js'
import {
  balanceEventsSubscriptions,
  balancesStorageMappers,
  customDiscoveryFetchers,
  getBalanceExtractor,
} from './mappers/index.js'
import {
  Balance,
  BalancesFromStorage,
  BalancesQueueData,
  CustomDiscoveryFetcher,
  RuntimeQueueData,
  StorageQueueData,
} from './types.js'

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
  readonly #balanceDiscoveryQueue = new Set<HexString>()
  readonly #balanceDiscoveryInProgress = new Set<HexString>()

  readonly #queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>
  readonly #broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs>

  #running = false
  #config: Record<string, any>

  constructor(
    { log, openLevelDB, ingress, config }: StewardManagerContext,
    queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>,
    broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs>,
  ) {
    this.#log = log
    this.#config = config ?? {}
    this.#substrateIngress = ingress.substrate
    this.#queries = queries
    this.#broadcaster = broadcaster
    this.#dbBalances = openLevelDB('steward:balances', { valueEncoding: 'buffer', keyEncoding: 'buffer' })
  }

  async start() {
    if ('balances' in this.#config && this.#config['balances']) {
      this.#log.info('[%s] started', this.id)
      this.#running = true
      this.#subscribeBalancesEvents()
      this.#processUpdateQueue()
      this.#processDiscoveryQueue()
    } else {
      this.#log.info('[%s] not configured', this.id)
    }
  }

  async stop() {
    this.#running = false
    for (const sub of this.#rxSubs) {
      sub.unsubscribe()
    }
    await this.#dbBalances.close()
  }

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

        const storageItems: Record<HexString, StorageQueueData> = {}
        const runtimeItems: Record<HexString, RuntimeQueueData> = {}
        const ops: BatchOperation<Buffer, Buffer>[] = []

        const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))

        for (const [key, data] of queue.entries()) {
          if (data.type === 'runtime') {
            runtimeItems[key] = data
          } else {
            storageItems[key] = data
          }
        }

        const storageKeys = Object.keys(storageItems) as HexString[]
        if (storageKeys.length) {
          try {
            const changesSets = await firstValueFrom(
              this.#substrateIngress.queryStorageAt(chainId, storageKeys),
            )
            for (const [storageKey, data] of Object.entries(storageItems)) {
              const { module, name, publicKey, assetKeyHash } = data
              const dbKey = balancesCodec.key.enc(publicKey, assetKeyHash)

              const shouldBeDiscovered = await this.#shouldBeDiscovered(publicKey)
              if (shouldBeDiscovered) {
                this.#balanceDiscoveryQueue.add(publicKey)
              }

              const changeSet = changesSets[0]?.changes.find(([key]) => key === storageKey)
              const rawValue = changeSet ? changeSet[1] : null

              if (rawValue !== null) {
                const codec = apiCtx.storageCodec(module, name)
                const decodedValue = codec.value.dec(rawValue)
                const balanceExtractor = getBalanceExtractor(module, name)
                if (balanceExtractor) {
                  const balance = balanceExtractor(decodedValue)
                  const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())

                  ops.push({ type: 'put', key: dbKey, value: dbValue })
                }
              } else {
                ops.push({ type: 'del', key: dbKey })
              }

              queue.delete(storageKey as HexString)
            }
          } catch (err) {
            this.#log.error(err, '[%s] failed processing queue for network %s', this.id, chainId)
          }
        }

        for (const [_, { api, method, args, assetKeyHash, publicKey }] of Object.entries(runtimeItems)) {
          const shouldBeDiscovered = await this.#shouldBeDiscovered(publicKey)
          if (shouldBeDiscovered) {
            this.#balanceDiscoveryQueue.add(publicKey)
          }
          const balance = await this.#fetchBalanceFromRuntime({
            chainId,
            api,
            method,
            args,
          })
          if (balance) {
            const dbKey = balancesCodec.key.enc(publicKey, assetKeyHash)
            const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())
            ops.push({ type: 'put', key: dbKey, value: dbValue })
          }
        }

        if (ops.length > 0) {
          try {
            await this.#dbBalances.batch(ops)
          } catch (err) {
            this.#log.error(err, '[%s] failed storing balances on #processUpdateQueue', this.id)
          }
        }
      }
    }
  }

  async #processDiscoveryQueue() {
    while (this.#running && this.#balanceDiscoveryInProgress.size < 5) {
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
        console.log(
          'Discovery complete for account: %s. Accounts left in queue: %s',
          account,
          this.#balanceDiscoveryQueue.size,
        )
        this.#balanceDiscoveryInProgress.delete(account)
      }
    }
  }

  async #discoverBalances(
    chainId: NetworkURN,
    account: HexString,
    apiCtx: SubstrateApiContext,
    pagination?: QueryPagination,
  ): Promise<void> {
    const customFetcher = customDiscoveryFetchers[chainId]
    if (customFetcher !== undefined) {
      await this.#runCustomDiscoveryFetcher(customFetcher, {
        chainId,
        account,
        apiCtx,
      })
    }

    const storageMapper = balancesStorageMappers[chainId]
    if (!storageMapper) {
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

    const storageItems: (BalancesFromStorage & { assetKeyHash: HexString })[] = items
      .map((i) => {
        const mapped = storageMapper(i, account, apiCtx)
        if (mapped === null) {
          return null
        }
        return {
          ...mapped,
          assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, i.id))) as HexString,
        }
      })
      .filter((i) => i !== null)

    if (storageItems.length > 0) {
      await this.#fetchBalancesFromStorage(chainId, account, apiCtx, storageItems)
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

  async #runCustomDiscoveryFetcher(
    fetcher: CustomDiscoveryFetcher,
    ctx: { chainId: NetworkURN; account: HexString; apiCtx: SubstrateApiContext },
  ) {
    try {
      const balances = await fetcher({ ...ctx, ingress: this.#substrateIngress })
      const ops: BatchOperation<Buffer, Buffer>[] = balances.map(({ assetId, balance }) => {
        const assetKeyHash = toHex(assetMetadataKeyHash(assetMetadataKey(ctx.chainId, assetId))) as HexString
        const dbKey = balancesCodec.key.enc(asPublicKey(ctx.account), assetKeyHash)
        const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())
        return { type: 'put', key: dbKey, value: dbValue }
      })
      if (ops.length > 0) {
        await this.#dbBalances.batch(ops)
      }
    } catch (error) {
      this.#log.error(
        error,
        `Error discovering balances with custom discovery fetcher for chain ${ctx.chainId}. account=${ctx.account}`,
      )
    }
  }

  async #fetchBalanceFromRuntime({
    chainId,
    api,
    method,
    args,
  }: {
    chainId: NetworkURN
    api: string
    method: string
    args: any[]
  }) {
    const value = await this.#substrateIngress.runtimeCall<Balance>(
      chainId,
      {
        api,
        method,
      },
      args,
    )
    if (value !== null) {
      const balanceExtractor = getBalanceExtractor(api, method)
      if (balanceExtractor) {
        return balanceExtractor(value)
      }
    }
    return null
  }

  async #fetchBalancesFromStorage(
    chainId: NetworkURN,
    account: HexString,
    apiCtx: SubstrateApiContext,
    storageItems: (BalancesFromStorage & { assetKeyHash: HexString })[],
  ) {
    const storageKeys = storageItems.map((i) => i.storageKey)
    const ops: BatchOperation<Buffer, Buffer>[] = []

    try {
      const changeSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, storageKeys))

      for (const { module, name, storageKey, assetKeyHash } of storageItems) {
        const changeSet = changeSets[0]?.changes.find(([key]) => key === storageKey)
        const rawValue = changeSet ? changeSet[1] : null

        if (rawValue !== null) {
          const codec = apiCtx.storageCodec(module, name)
          const decodedValue = codec.value.dec(rawValue)

          const balanceExtractor = getBalanceExtractor(module, name)
          if (balanceExtractor) {
            const balance = balanceExtractor(decodedValue)
            const dbKey = balancesCodec.key.enc(account, assetKeyHash)
            const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())
            ops.push({ type: 'put', key: dbKey, value: dbValue })
          }
        }
      }

      if (ops.length > 0) {
        await this.#dbBalances.batch(ops)
      }
    } catch (err) {
      this.#log.error(
        err,
        '[%s] failed fetching balances from storage for account %s on %s',
        this.id,
        account,
        chainId,
      )
    }
  }

  async #shouldBeDiscovered(publicKey: HexString): Promise<boolean> {
    return (
      !this.#balanceDiscoveryQueue.has(publicKey) &&
      !this.#balanceDiscoveryInProgress.has(publicKey) &&
      !(await this.#hasBeenDiscovered(publicKey))
    )
  }

  async #markDiscovered(account: string): Promise<void> {
    const key = Buffer.concat([DISCO_MARKER_BYTE, normaliseAddress(asPublicKey(account))])
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

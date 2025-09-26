import { LRUCache } from 'lru-cache'
import { toHex } from 'polkadot-api/utils'
import { Subscription, firstValueFrom } from 'rxjs'

import { asAccountId, asPublicKey } from '@/common/util.js'
import { HexString, QueryPagination, QueryParams, QueryResult } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { BatchOperation, LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { ServerSideEventsBroadcaster, ServerSideEventsRequest } from '../../types.js'
import {
  AssetId,
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
import { AssetData, BalanceEvents } from './sse.js'
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
  readonly #broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs, BalanceEvents>
  readonly #metadataCache: LRUCache<HexString, AssetData, unknown>

  #running = false
  #config: Record<string, any>

  constructor(
    { log, openLevelDB, ingress, config }: StewardManagerContext,
    queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>,
    broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs, BalanceEvents>,
  ) {
    this.#log = log
    this.#config = config ?? {}
    this.#substrateIngress = ingress.substrate
    this.#queries = queries
    this.#broadcaster = broadcaster
    this.#dbBalances = openLevelDB('steward:balances', { valueEncoding: 'buffer', keyEncoding: 'buffer' })
    this.#metadataCache = new LRUCache({
      ttl: 21_600_000, // 6 hrs
      ttlResolution: 60_000,
      ttlAutopurge: false,
      max: 500,
    })
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

  async *streamAccountBalances(accountHex: HexString) {
    const prefix = normaliseAddress(accountHex) // 32 bytes
    const start = Buffer.from(prefix)
    let end = Buffer.from(prefix)
    // increment last byte to create an upper bound for the prefix
    for (let i = end.length - 1; i >= 0; i--) {
      if (end[i] < 0xff) {
        end[i]++
        end = end.subarray(0, i + 1)
        break
      }
    }

    const iterator = this.#dbBalances.iterator({
      gte: start,
      lt: end,
    })

    for await (const [keyBuf, valueBuf] of iterator) {
      const { addressHex, assetIdHex } = balancesCodec.key.dec(keyBuf)
      const { balance, epochSeconds } = balancesCodec.value.dec(valueBuf)
      yield { addressHex, assetIdHex, balance, epochSeconds }
    }
  }

  // TODO: limit number of queued accounts per connection/IP
  async onServerSideEventsRequest(request: ServerSideEventsRequest<StewardServerSideEventArgs>) {
    try {
      // open stream
      const {
        id,
        filters: { account },
      } = this.#broadcaster.stream(request)
      const pubKeysToFetch = Array.isArray(account)
        ? account.map((a) => ({ accountId: a, publicKey: asPublicKey(a) }))
        : [{ accountId: account, publicKey: asPublicKey(account) }]

      for (const { accountId, publicKey } of pubKeysToFetch) {
        const isDiscovered = await this.#dbBalances.get(
          Buffer.concat([DISCO_MARKER_BYTE, normaliseAddress(publicKey)]),
        )
        if (isDiscovered) {
          this.#broadcaster.sendToConnection(id, {
            event: 'status',
            data: {
              status: 'discovered',
              accountId,
              publicKey,
            },
          })

          await this.#streamBalancesFromDB({
            connectionId: id,
            accountId,
            publicKey,
          })
          // notify client when done
          this.#broadcaster.sendToConnection(id, {
            event: 'synced',
            data: { accountId, publicKey },
          })
        } else if (this.#balanceDiscoveryInProgress.has(publicKey)) {
          this.#broadcaster.sendToConnection(id, {
            event: 'status',
            data: {
              status: 'discovery-in-progress',
              accountId,
              publicKey,
            },
          })
          await this.#streamBalancesFromDB({
            connectionId: id,
            accountId,
            publicKey,
          })
        } else if (this.#balanceDiscoveryQueue.has(publicKey)) {
          this.#broadcaster.sendToConnection(id, {
            event: 'status',
            data: {
              status: 'discovery-enqueued',
              accountId,
              publicKey,
            },
          })
        } else {
          // TODO: limit number to accounts that can be enqueued from request
          this.#balanceDiscoveryQueue.add(publicKey)
          this.#broadcaster.sendToConnection(id, {
            event: 'status',
            data: {
              status: 'discovery-enqueued',
              accountId,
              publicKey,
            },
          })
        }
      }
    } catch (e) {
      this.#log.error(e, '[%s] Error on server side events request', this.id)
    }
  }

  async #streamBalancesFromDB({
    connectionId,
    accountId,
    publicKey,
  }: {
    connectionId: string
    accountId: string
    publicKey: HexString
  }) {
    for await (const entry of this.streamAccountBalances(publicKey)) {
      const metadata = await this.#getAssetMetadataByHash(entry.assetIdHex)
      if (metadata) {
        this.#broadcaster.sendToConnection(connectionId, {
          event: 'balance',
          data: {
            origin: 'snapshot',
            accountId,
            publicKey,
            balance: entry.balance,
            ...metadata,
          },
        })
      }
    }
  }

  #subscribeBalancesEvents() {
    const chainIds = this.#substrateIngress.getChainIds()

    for (const chainId of chainIds) {
      if (this.#substrateIngress.isNetworkDefined(chainId)) {
        const balancesSubMappers = balanceEventsSubscriptions[chainId]
        if (balancesSubMappers) {
          this.#log.info('[agent:%s] watching for balances updates %s', this.id, chainId)
          this.#rxSubs.push(...balancesSubMappers(this.#substrateIngress, this.#enqueue.bind(this)))
        }
      }
    }
  }

  #enqueue(chainId: NetworkURN, key: HexString, data: BalancesQueueData) {
    const queue = (this.#balanceUpdateQueue[chainId] ??= new Map<HexString, BalancesQueueData>())

    if (!queue.has(key)) {
      queue.set(key, data)
    }
  }

  async #processUpdateQueue() {
    while (this.#running) {
      const queues = Object.entries(this.#balanceUpdateQueue) as [
        NetworkURN,
        Map<HexString, BalancesQueueData>,
      ][]

      if (!queues.some(([_, queue]) => queue.size > 0)) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      for (const [chainId, queue] of queues) {
        if (queue.size === 0) {
          continue
        }

        const storageItems: Record<HexString, StorageQueueData> = {}
        const runtimeItems: Record<HexString, RuntimeQueueData> = {}
        const ops: BatchOperation<Buffer, Buffer>[] = []

        for (const [key, data] of queue.entries()) {
          if (data.type === 'runtime') {
            runtimeItems[key] = data
          } else {
            storageItems[key] = data
          }
        }

        // Process storage items
        await this.#processStorageQueue(chainId, storageItems, queue, ops)
        // Process runtime items
        await this.#processRuntimeQueue(chainId, runtimeItems, queue, ops)

        if (ops.length > 0) {
          try {
            await this.#dbBalances.batch(ops)
          } catch (err) {
            this.#log.error(err, '[%s] failed storing balances in #processUpdateQueue', this.id)
          }
        }
      }
    }
  }

  async #processStorageQueue(
    chainId: NetworkURN,
    storageItems: Record<HexString, StorageQueueData>,
    queue: Map<HexString, BalancesQueueData>,
    ops: BatchOperation<Buffer, Buffer>[],
  ) {
    const keys = Object.keys(storageItems) as HexString[]
    if (!keys.length) {
      return
    }

    try {
      const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))
      const changesSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, keys))

      await Promise.all(
        keys.map(async (storageKey) => {
          const data = storageItems[storageKey]
          const { module, name, publicKey, assetKeyHash } = data
          if (await this.#shouldBeDiscovered(publicKey)) {
            this.#balanceDiscoveryQueue.add(publicKey)
          }

          const change = changesSets[0]?.changes.find(([key]) => key === storageKey)
          const rawValue = change ? change[1] : null
          const dbKey = balancesCodec.key.enc(publicKey, assetKeyHash)

          if (rawValue !== null) {
            const codec = apiCtx?.storageCodec(module, name)
            const decoded = codec?.value.dec(rawValue)
            const balanceExtractor = getBalanceExtractor(module, name)
            const balance = balanceExtractor?.(decoded) ?? 0n
            await this.#handleBalanceUpdate(publicKey, assetKeyHash, balance, dbKey, ops)
          } else {
            await this.#handleBalanceUpdate(publicKey, assetKeyHash, 0n, dbKey, ops)
          }

          queue.delete(storageKey)
        }),
      )
    } catch (err) {
      this.#log.error(err, '[%s] failed querying storage for chain %s', this.id, chainId)
      // Clear the keys from the queue to avoid clogging
      keys.forEach((k) => queue.delete(k))
    }
  }

  async #processRuntimeQueue(
    chainId: NetworkURN,
    runtimeItems: Record<HexString, RuntimeQueueData>,
    queue: Map<HexString, BalancesQueueData>,
    ops: BatchOperation<Buffer, Buffer>[],
  ) {
    await Promise.all(
      Object.values(runtimeItems).map(async (item) => {
        const { api, method, args, assetKeyHash, publicKey } = item
        try {
          if (await this.#shouldBeDiscovered(publicKey)) {
            this.#balanceDiscoveryQueue.add(publicKey)
          }

          const balance = await this.#fetchBalanceFromRuntime({ chainId, api, method, args })
          const dbKey = balancesCodec.key.enc(publicKey, assetKeyHash)

          await this.#handleBalanceUpdate(publicKey, assetKeyHash, balance, dbKey, ops)
        } catch (err) {
          this.#log.error(err, '[%s] failed querying runtime for chain %s', this.id, chainId)
        } finally {
          queue.delete(publicKey)
        }
      }),
    )
  }

  async #handleBalanceUpdate(
    publicKey: HexString,
    assetKeyHash: HexString,
    balance: bigint | null,
    dbKey: Buffer,
    ops: BatchOperation<Buffer, Buffer>[],
  ) {
    const dbValue = balance !== null ? balancesCodec.value.enc(balance, epochSecondsNow()) : null
    if (dbValue !== null) {
      ops.push({ type: 'put', key: dbKey, value: dbValue })
    } else {
      ops.push({ type: 'del', key: dbKey })
    }

    try {
      const metadata = await this.#getAssetMetadataByHash(assetKeyHash)
      if (metadata) {
        this.#broadcaster.send({
          event: 'balance',
          data: {
            origin: 'update',
            accountId: asAccountId(publicKey),
            publicKey,
            balance: balance ?? 0n,
            ...metadata,
          },
        })
      }
    } catch (err) {
      this.#log.error(err, 'Error broadcasting balance update for publicKey %s', publicKey)
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
        await this.#markDiscovered(account)
      } catch (err) {
        this.#log.error(err, '[%s] failed processing discovery for account %s', this.id, account)
      } finally {
        this.#log.info(
          'Discovery complete for account: %s. Accounts left in queue: %s',
          account,
          this.#balanceDiscoveryQueue.size,
        )
        this.#balanceDiscoveryInProgress.delete(account)
        this.#broadcaster.send({
          event: 'synced',
          data: { accountId: asAccountId(account), publicKey: account },
        })
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

    const storageItems: (BalancesFromStorage & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[] = items
      .map((i) => {
        const mapped = storageMapper(i, account, apiCtx)
        if (mapped === null) {
          return null
        }
        return {
          ...mapped,
          assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, i.id))) as HexString,
          assetId: i.id,
          symbol: i.symbol,
          decimals: i.decimals,
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

      const ops: BatchOperation<Buffer, Buffer>[] = []
      for (const { assetId, balance } of balances) {
        const assetKeyHash = toHex(assetMetadataKeyHash(assetMetadataKey(ctx.chainId, assetId))) as HexString
        const dbKey = balancesCodec.key.enc(asPublicKey(ctx.account), assetKeyHash)
        const dbValue = balancesCodec.value.enc(balance, epochSecondsNow())
        ops.push({ type: 'put', key: dbKey, value: dbValue })
        try {
          const metadata = await this.#getAssetMetadataByHash(assetKeyHash)
          if (metadata) {
            this.#broadcaster.send({
              event: 'balance',
              data: {
                origin: 'snapshot',
                accountId: asAccountId(ctx.account),
                publicKey: ctx.account,
                balance,
                ...metadata,
              },
            })
          }
        } catch (err) {
          this.#log.error(err, 'Error broadcasting balance in #runCustomDiscoveryFetcher')
        }
      }
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
    storageItems: (BalancesFromStorage & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[],
  ) {
    const storageKeys = storageItems.map((i) => i.storageKey)
    const ops: BatchOperation<Buffer, Buffer>[] = []

    try {
      const changeSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, storageKeys))

      for (const { module, name, storageKey, assetKeyHash, assetId, decimals, symbol } of storageItems) {
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
            this.#broadcaster.send({
              event: 'balance',
              data: {
                origin: 'snapshot',
                accountId: asAccountId(account),
                publicKey: account,
                chainId,
                assetId,
                balance,
                symbol,
                decimals,
              },
            })
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

  async #getAssetMetadataByHash(assetHash: HexString): Promise<AssetData | undefined> {
    const cached = this.#metadataCache.get(assetHash)
    if (cached) {
      return cached
    }

    const { items } = (await this.#queries({
      args: {
        op: 'assets.by_hash',
        criteria: { assetHashes: [assetHash] },
      },
    })) as QueryResult<AssetMetadata>

    if (items.length > 0) {
      const { chainId, id, symbol, decimals } = items[0]
      const metadata = {
        chainId,
        assetId: id,
        symbol,
        decimals,
      }
      this.#metadataCache.set(assetHash, metadata)
      return metadata
    }

    return undefined
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

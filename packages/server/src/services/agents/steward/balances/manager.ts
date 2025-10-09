import { Mutex } from 'async-mutex'
import { LRUCache } from 'lru-cache'
import { toHex } from 'polkadot-api/utils'
import { Subscription, firstValueFrom } from 'rxjs'

import { asAccountId, asPublicKey } from '@/common/util.js'
import { HexString, QueryPagination, QueryParams, QueryResult } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Logger, NetworkURN } from '@/services/types.js'

import { ControlQuery, Criteria } from '@/common/index.js'
import { MaxEnqueuedError, PriorityQueue } from '../../../../common/pqueue.js'
import { ServerSentEventsBroadcaster, ServerSentEventsRequest } from '../../types.js'
import { fetchSS58Prefix } from '../metadata/queries/helper.js'
import {
  AssetId,
  AssetMetadata,
  StewardManagerContext,
  StewardQueries,
  StewardQueryArgs,
  StewardServerSentEventArgs,
} from '../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../util.js'
import { BalanceRecord, BalancesDB } from './db.js'
import {
  balanceEventsSubscriptions,
  balancesRuntimeCallMappers,
  balancesStorageMappers,
  customDiscoveryFetchers,
  getBalanceExtractor,
  onDemandFetchers,
} from './mappers/index.js'
import { AssetData, BalanceEvents } from './sse.js'
import {
  Balance,
  BalancesQueueData,
  CustomDiscoveryFetcher,
  RuntimeQueryParams,
  RuntimeQueueData,
  StorageQueryParams,
  StorageQueueData,
} from './types.js'

const UPDATE_QUEUE_LIMIT = 5_000
const STORAGE_CAP = 500
const RUNTIME_CAP = 50

type BalanceUpdateMode = 'streaming' | 'on-demand'

export class BalancesManager {
  id = 'steward:balances'

  readonly #log: Logger
  readonly #substrateIngress: SubstrateIngressConsumer

  readonly #dbBalances: BalancesDB

  readonly #rxSubs: Subscription[] = []
  readonly #accountControl: ControlQuery

  readonly #balanceUpdateQueue: Record<NetworkURN, Map<string, BalancesQueueData>> = {}
  readonly #balanceDiscoveryQueue = new PriorityQueue<HexString>({ maxEnqueuedItems: 10 })
  readonly #balanceDiscoveryInProgress = new Set<HexString>()

  readonly #requestedAccountRefs: Map<HexString, number> = new Map()

  readonly #queries: (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>
  readonly #broadcaster: ServerSentEventsBroadcaster<StewardServerSentEventArgs, BalanceEvents>
  readonly #metadataCache: LRUCache<HexString, AssetData, unknown>

  readonly #chainMutexes: Record<NetworkURN, Mutex> = {}

  #mode: BalanceUpdateMode = 'streaming'
  #running = false
  #config: Record<string, any>

  constructor(
    { log, openLevelDB, ingress, config }: StewardManagerContext,
    queries: StewardQueries,
    broadcaster: ServerSentEventsBroadcaster<StewardServerSentEventArgs, BalanceEvents>,
  ) {
    this.#log = log
    this.#config = config ?? {}
    this.#substrateIngress = ingress.substrate
    this.#queries = queries
    this.#broadcaster = broadcaster
    this.#accountControl = ControlQuery.from(this.#accountsCriteria([]))
    this.#dbBalances = new BalancesDB(
      openLevelDB('steward:balances', { valueEncoding: 'buffer', keyEncoding: 'buffer' }),
    )
    this.#metadataCache = new LRUCache({
      ttl: 21_600_000, // 6 hrs
      ttlResolution: 60_000,
      ttlAutopurge: false,
      max: 1_000,
    })
  }

  async start() {
    this.#log.info('[%s] started in %s mode.', this.id, this.#mode)
    if (this.#mode === 'streaming') {
      this.#subscribeBalancesEvents()
    }
    this.#running = true
    this.#processUpdateQueue()
    this.#processDiscoveryQueue()
  }

  async stop() {
    this.#log.info('[%s] stopping...', this.id)
    this.#running = false
    for (const sub of this.#rxSubs) {
      sub.unsubscribe()
    }
    await this.#dbBalances.close()
    for (const mutex of Object.values(this.#chainMutexes)) {
      await mutex.waitForUnlock()
    }
  }

  async onServerSentEventsRequest(request: ServerSentEventsRequest<StewardServerSentEventArgs>) {
    try {
      // open stream
      const {
        id,
        filters: { account },
      } = this.#broadcaster.stream(request, {
        onConnect: (connection) => {
          const { account } = connection.filters
          if (account) {
            try {
              this.#updateAccountControl(account)
            } catch (e) {
              this.#log.error(e, 'Error on update account control (adding account=%s)', account)
            }
          }
        },
        onDisconnect: (connection) => {
          const { account } = connection.filters
          if (account) {
            try {
              this.#updateAccountControl([], account)
            } catch (e) {
              this.#log.error(e, 'Error on update account control (removing account=%s)', account)
            }
          }
        },
      })

      const pubKeysToFetch = Array.isArray(account)
        ? account.map((a) => ({ accountId: a, publicKey: asPublicKey(a) }))
        : [{ accountId: account, publicKey: asPublicKey(account) }]

      for (const { accountId, publicKey } of pubKeysToFetch) {
        if (this.#mode === 'streaming') {
          // === STREAMING MODE ===
          if (await this.#dbBalances.hasBeenDiscovered(publicKey)) {
            this.#broadcaster.sendToConnection(id, {
              event: 'status',
              data: { status: 'discovered', accountId, publicKey },
            })

            await this.#streamSnapshot({ connectionId: id, publicKey })

            this.#broadcaster.sendToConnection(id, {
              event: 'synced',
              data: { accountId, publicKey },
            })
          } else if (this.#balanceDiscoveryInProgress.has(publicKey)) {
            this.#broadcaster.sendToConnection(id, {
              event: 'status',
              data: { status: 'discovery-in-progress', accountId, publicKey },
            })

            await this.#streamSnapshot({ connectionId: id, publicKey })
          } else if (this.#balanceDiscoveryQueue.has(publicKey)) {
            this.#broadcaster.sendToConnection(id, {
              event: 'status',
              data: { status: 'discovery-enqueued', accountId, publicKey },
            })
          } else {
            this.#enqueueForDiscovery({
              publicKey,
              requestUid: request.uid,
              connectionId: id,
              accountId,
            })
          }
        } else {
          // === ON-DEMAND MODE ===
          this.#enqueueForDiscovery({ publicKey, requestUid: request.uid, connectionId: id, accountId })
        }
      }
    } catch (e) {
      this.#log.error(e, '[%s] Error on server sent events request', this.id)
    }
  }

  #enqueueForDiscovery({
    accountId,
    publicKey,
    connectionId,
    requestUid,
  }: {
    accountId: string
    publicKey: HexString
    connectionId: string
    requestUid?: string
  }) {
    try {
      this.#balanceDiscoveryQueue.enqueue(publicKey, requestUid)
      this.#broadcaster.sendToConnection(connectionId, {
        event: 'status',
        data: {
          status: 'discovery-enqueued',
          accountId,
          publicKey,
        },
      })
    } catch (e) {
      if (e instanceof MaxEnqueuedError) {
        this.#broadcaster.sendToConnection(connectionId, {
          event: 'status',
          data: {
            status: 'max-addresses-enqueued-reached',
            accountId,
            publicKey,
          },
        })
      } else {
        this.#log.error(e, '[%s] Error enqueueing new address on request addr=%s', this.id, publicKey)
      }
    }
  }

  async #streamSnapshot(opts: { connectionId: string; publicKey: HexString }) {
    await this.#fetchOnDemandBalances(opts.publicKey)
    await this.#streamBalancesFromDB(opts)
  }

  async #streamBalancesFromDB({
    connectionId,
    publicKey,
  }: {
    connectionId: string
    publicKey: HexString
  }) {
    for await (const entry of this.#dbBalances.iterateAccountBalances(publicKey)) {
      const metadata = await this.#getAssetMetadataByHash(entry.assetIdHex)
      if (metadata) {
        const prefix = await fetchSS58Prefix(this.#queries, metadata.chainId)

        this.#broadcaster.sendToConnection(connectionId, {
          event: 'balance',
          data: {
            origin: 'snapshot',
            accountId: asAccountId(publicKey, prefix),
            publicKey,
            balance: entry.balance,
            ...metadata,
          },
        })
      }
    }
  }

  async #fetchOnDemandBalances(publicKey: HexString) {
    for (const chainId of this.#substrateIngress.getChainIds()) {
      if (!this.#substrateIngress.isNetworkDefined(chainId)) {
        continue
      }

      const fetcher = onDemandFetchers[chainId]
      if (!fetcher) {
        continue
      }

      const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))
      const balances = await fetcher({
        chainId,
        account: publicKey,
        apiCtx,
        ingress: this.#substrateIngress,
      })

      const balanceRecords: BalanceRecord[] = []

      for (const { assetId, balance } of balances) {
        const assetKeyHash = toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString
        balanceRecords.push({ accountHex: publicKey, assetKeyHash, balance })
      }

      if (balanceRecords.length > 0) {
        await this.#dbBalances.putBatch(balanceRecords)
      }
    }
  }

  #subscribeBalancesEvents() {
    // Avoid duplicate subscriptions
    if (this.#rxSubs.length > 0) {
      this.#log.warn('Subscriptions already active, skipping re-subscribe')
      return
    }
    const chainIds = this.#substrateIngress.getChainIds()

    for (const chainId of chainIds) {
      if (this.#substrateIngress.isNetworkDefined(chainId)) {
        const balancesSubMappers = balanceEventsSubscriptions[chainId]
        if (balancesSubMappers) {
          const subscriptions = balancesSubMappers(this.#substrateIngress, this.#accountControl).map(($) => {
            return $.subscribe({
              next: ({ queueKey, data }) => {
                this.#enqueue(chainId, queueKey, data)
              },
              error: (e) =>
                this.#log.error(e, '[%s] Error in balance update subscription chain=%s', this.id, chainId),
            })
          })
          this.#log.info(
            '[%s] watching for balances updates chain=%s #subs=%s',
            this.id,
            chainId,
            subscriptions.length,
          )
          this.#rxSubs.push(...subscriptions)
        }
      }
    }
  }

  #enqueue(chainId: NetworkURN, key: string, data: BalancesQueueData) {
    const queue = (this.#balanceUpdateQueue[chainId] ??= new Map<string, BalancesQueueData>())

    if (queue.size > UPDATE_QUEUE_LIMIT) {
      this.#log.info('[%s] update queue limit reached (chain=%s)', this.id, chainId)
      this.#switchMode('on-demand')
      return
    }

    if (!queue.has(key)) {
      queue.set(key, data)
    }
  }

  async #processUpdateQueue() {
    while (this.#running) {
      const queues = Object.entries(this.#balanceUpdateQueue) as [
        NetworkURN,
        Map<string, BalancesQueueData>,
      ][]

      if (!queues.some(([_, queue]) => queue.size > 0)) {
        if (this.#mode === 'on-demand') {
          this.#switchMode('streaming')
        }
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      for (const [chainId, queue] of queues) {
        if (queue.size === 0) {
          continue
        }

        const mutex = (this.#chainMutexes[chainId] ??= new Mutex())
        const release = await mutex.acquire()

        const storageItems: Record<string, StorageQueueData> = {}
        const runtimeItems: Record<string, RuntimeQueueData> = {}
        const records: BalanceRecord[] = []

        for (const [key, data] of queue.entries()) {
          if (data.type === 'runtime') {
            runtimeItems[key] = data
          } else {
            storageItems[key] = data
          }
        }

        const storageBatchKeys = Object.keys(storageItems).slice(0, STORAGE_CAP)
        const runtimeBatchKeys = Object.keys(runtimeItems).slice(0, RUNTIME_CAP)

        const storageBatch: Record<string, StorageQueueData> = {}
        const runtimeBatch: Record<string, RuntimeQueueData> = {}

        storageBatchKeys.forEach((k) => {
          storageBatch[k] = storageItems[k]
          queue.delete(k)
        })
        runtimeBatchKeys.forEach((k) => {
          runtimeBatch[k] = runtimeItems[k]
          queue.delete(k)
        })

        try {
          await Promise.all([
            this.#processStorageQueue(chainId, storageBatch, records),
            this.#processRuntimeQueue(chainId, runtimeBatch, records),
          ])
          await this.#dbBalances.putBatch(records)
        } catch (err) {
          this.#log.error(err, '[%s] failed processing balance update for chain=%s', this.id, chainId)
        } finally {
          release()
        }
      }
    }
  }

  async #processStorageQueue(
    chainId: NetworkURN,
    storageItems: Record<HexString, StorageQueueData>,
    records: BalanceRecord[],
  ) {
    const items = Object.values(storageItems)

    if (!items.length) {
      return
    }

    const keys = items.map((v) => v.storageKey)
    try {
      const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))
      const changesSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, keys))

      await Promise.all(
        items.map(async (data) => {
          const { module, name, publicKey, assetKeyHash, storageKey } = data

          const change = changesSets[0]?.changes.find(([key]) => key === storageKey)
          const rawValue = change ? change[1] : null
          let balance: bigint | null = null

          if (rawValue !== null) {
            const codec = apiCtx?.storageCodec(module, name)
            const decoded = codec?.value.dec(rawValue)
            const balanceExtractor = getBalanceExtractor(module, name)
            balance = balanceExtractor?.(decoded) ?? null
          }
          records.push({ accountHex: publicKey, assetKeyHash, balance })
          await this.#streamBalance({ origin: 'update', accountHex: publicKey, assetKeyHash, balance })
        }),
      )
    } catch (err) {
      this.#log.error(err, '[%s] failed querying storage for chain %s', this.id, chainId)
    }
  }

  async #processRuntimeQueue(
    chainId: NetworkURN,
    runtimeItems: Record<HexString, RuntimeQueueData>,
    records: BalanceRecord[],
  ) {
    if (Object.keys(runtimeItems).length === 0) {
      return
    }
    await Promise.all(
      Object.values(runtimeItems).map(async (item) => {
        const { api, method, args, assetKeyHash, publicKey } = item
        try {
          const balance = await this.#fetchBalanceFromRuntime({ chainId, api, method, args })

          records.push({ accountHex: publicKey, assetKeyHash, balance })
          await this.#streamBalance({ origin: 'update', accountHex: publicKey, assetKeyHash, balance })
        } catch (err) {
          this.#log.error(err, '[%s] failed querying runtime for chain %s', this.id, chainId)
        }
      }),
    )
  }

  async #streamBalance({
    origin,
    accountHex,
    assetKeyHash,
    balance,
    assetMetadata,
  }: {
    origin: 'update' | 'snapshot'
    accountHex: HexString
    assetKeyHash: HexString
    balance: bigint | null
    assetMetadata?: AssetData
  }) {
    try {
      const metadata = assetMetadata ?? (await this.#getAssetMetadataByHash(assetKeyHash))
      if (metadata) {
        const prefix = await fetchSS58Prefix(this.#queries, metadata.chainId)
        this.#broadcaster.send({
          event: 'balance',
          data: {
            origin,
            accountId: asAccountId(accountHex, prefix),
            publicKey: accountHex,
            balance: balance ?? 0n,
            ...metadata,
          },
        })
      }
    } catch (err) {
      this.#log.error(err, 'Error broadcasting balance update for publicKey %s', accountHex)
    }
  }

  async #processDiscoveryQueue() {
    while (this.#running && this.#balanceDiscoveryInProgress.size < 5) {
      if (this.#balanceDiscoveryQueue.size === 0) {
        await new Promise((r) => setTimeout(r, 1_000))
        continue
      }

      const account = this.#balanceDiscoveryQueue.dequeue()

      if (!account || this.#balanceDiscoveryInProgress.has(account)) {
        continue
      }

      this.#balanceDiscoveryInProgress.add(account)

      try {
        const chainIds = this.#substrateIngress.getChainIds()

        for (const chainId of chainIds) {
          if (!this.#substrateIngress.isNetworkDefined(chainId)) {
            continue
          }
          const mutex = (this.#chainMutexes[chainId] ??= new Mutex())
          const release = await mutex.acquire()
          try {
            const apiCtx = await firstValueFrom(this.#substrateIngress.getContext(chainId))
            await this.#discoverBalances(chainId, account, apiCtx, { limit: 100 })
          } finally {
            release()
          }
        }
        await this.#dbBalances.markDiscovered(account)
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
          data: { accountId: account, publicKey: account },
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

    const storageMapper = balancesStorageMappers[chainId]
    const runtimeMapper = balancesRuntimeCallMappers[chainId]
    if (!storageMapper && !runtimeMapper) {
      return
    }
    const storageItems: (StorageQueryParams & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[] = []

    const runtimeItems: (RuntimeQueryParams & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[] = []

    for (const i of items) {
      if (storageMapper) {
        const mapped = storageMapper(i, account, apiCtx)
        if (mapped !== null) {
          storageItems.push({
            ...mapped,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, i.id))) as HexString,
            assetId: i.id,
            symbol: i.symbol,
            decimals: i.decimals,
          })
        }
      }
      if (runtimeMapper) {
        const mapped = runtimeMapper(i, account, apiCtx)
        if (mapped !== null) {
          runtimeItems.push({
            ...mapped,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, i.id))) as HexString,
            assetId: i.id,
            symbol: i.symbol,
            decimals: i.decimals,
          })
        }
      }
    }

    if (storageItems.length > 0) {
      await this.#discoverBalancesFromStorage(chainId, account, apiCtx, storageItems)
    }

    if (runtimeItems.length > 0) {
      await this.#discoverBalancesFromRuntime(chainId, account, runtimeItems)
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

      const ops: BalanceRecord[] = []
      for (const { assetId, balance } of balances) {
        if (balance === null || balance === 0n) {
          continue
        }
        const assetKeyHash = toHex(assetMetadataKeyHash(assetMetadataKey(ctx.chainId, assetId))) as HexString
        ops.push({ accountHex: ctx.account, assetKeyHash, balance })
        await this.#streamBalance({
          origin: 'snapshot',
          accountHex: ctx.account,
          assetKeyHash,
          balance,
        })
      }
      await this.#dbBalances.putBatch(ops)
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

  async #processDiscoveredBalances(
    chainId: NetworkURN,
    account: HexString,
    items: {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
      fetchFn: () => Promise<any | null>
      extractorKey: { apiOrModule: string; methodOrName: string }
    }[],
  ) {
    const ops: BalanceRecord[] = []

    for (const { assetKeyHash, assetId, symbol, decimals, fetchFn, extractorKey } of items) {
      try {
        const rawValue = await fetchFn()
        if (rawValue === null || rawValue === undefined) {
          continue
        }

        const balanceExtractor = getBalanceExtractor(extractorKey.apiOrModule, extractorKey.methodOrName)
        if (!balanceExtractor) {
          continue
        }

        const balance = balanceExtractor(rawValue)
        if (balance <= 0n) {
          continue
        }

        ops.push({ accountHex: account, assetKeyHash, balance })

        await this.#streamBalance({
          origin: 'snapshot',
          accountHex: account,
          assetKeyHash,
          balance,
          assetMetadata: {
            assetId,
            chainId,
            decimals,
            symbol,
          },
        })
      } catch (err) {
        this.#log.error(
          err,
          '[%s] failed processing discovered balances (%s) for account %s on %s',
          this.id,
          Object.values(extractorKey).join('.'),
          account,
          chainId,
        )
      }
    }

    if (ops.length > 0) {
      await this.#dbBalances.putBatch(ops)
    }
  }

  async #discoverBalancesFromRuntime(
    chainId: NetworkURN,
    account: HexString,
    runtimeItems: (RuntimeQueryParams & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[],
  ) {
    const items = runtimeItems.map(({ api, method, args, assetKeyHash, assetId, symbol, decimals }) => ({
      assetKeyHash,
      assetId,
      symbol,
      decimals,
      extractorKey: { apiOrModule: api, methodOrName: method },
      fetchFn: () => this.#fetchBalanceFromRuntime({ chainId, api, method, args }),
    }))

    await this.#processDiscoveredBalances(chainId, account, items)
  }

  async #discoverBalancesFromStorage(
    chainId: NetworkURN,
    account: HexString,
    apiCtx: SubstrateApiContext,
    storageItems: (StorageQueryParams & {
      assetKeyHash: HexString
      assetId: AssetId
      symbol?: string
      decimals?: number
    })[],
  ) {
    const storageKeys = storageItems.map((i) => i.storageKey)
    const changeSets = await firstValueFrom(this.#substrateIngress.queryStorageAt(chainId, storageKeys))

    const items = storageItems.map(
      ({ module, name, storageKey, assetKeyHash, assetId, symbol, decimals }) => {
        const changeSet = changeSets[0]?.changes.find(([key]) => key === storageKey)
        const rawValue = changeSet ? changeSet[1] : null

        return {
          assetKeyHash,
          assetId,
          symbol,
          decimals,
          extractorKey: { apiOrModule: module, methodOrName: name },
          fetchFn: async () => {
            if (rawValue === null) {
              return null
            }
            const codec = apiCtx.storageCodec(module, name)
            return codec.value.dec(rawValue)
          },
        }
      },
    )

    await this.#processDiscoveredBalances(chainId, account, items)
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

  #accountsCriteria(accounts: string[]): Criteria {
    if (accounts.length === 0) {
      // matches none
      return { $expr: { $eq: [1, 0] } }
    }

    const pubKeys = accounts.map(asPublicKey)
    return { account: { $in: pubKeys } }
  }

  #updateAccountControl(toAdd: string | string[] = [], toRemove: string | string[] = []) {
    const addList = Array.isArray(toAdd) ? toAdd : [toAdd]
    const removeList = Array.isArray(toRemove) ? toRemove : [toRemove]

    for (const acc of addList) {
      const pk = asPublicKey(acc)
      this.#requestedAccountRefs.set(pk, (this.#requestedAccountRefs.get(pk) ?? 0) + 1)
    }

    for (const acc of removeList) {
      const pk = asPublicKey(acc)
      const current = this.#requestedAccountRefs.get(pk) ?? 0
      if (current <= 1) {
        this.#requestedAccountRefs.delete(pk)
      } else {
        this.#requestedAccountRefs.set(pk, current - 1)
      }
    }

    this.#accountControl.change(this.#accountsCriteria([...this.#requestedAccountRefs.keys()]))
  }

  #switchMode(mode: BalanceUpdateMode) {
    if (this.#mode === mode) {
      // nothing to do
      return
    }

    for (const sub of this.#rxSubs) {
      try {
        sub.unsubscribe()
      } catch (err) {
        this.#log?.warn?.('Failed to unsubscribe cleanly', err)
      }
    }
    this.#rxSubs.length = 0

    this.#mode = mode

    if (mode === 'streaming') {
      this.#subscribeBalancesEvents()
    }
    this.#log.info('[%s] Switched to %s mode', this.id, this.#mode)
  }
}

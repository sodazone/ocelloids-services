import { AbstractSublevel } from 'abstract-level'
import { LRUCache } from 'lru-cache'
import { toHex } from 'polkadot-api/utils'
import { filter, merge, Observable, Subscription } from 'rxjs'
import { padAccountKey20, ss58ToPublicKey } from '@/common/address.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Scheduled, Scheduler } from '@/services/scheduling/scheduler.js'
import { HexString } from '@/services/subscriptions/types.js'
import { LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { Empty, StewardManagerContext, StewardQueryArgs } from '../types.js'
import { limitCap, paginatedResults } from '../util.js'
import { extraAccountMeta$, identities$, mergeAccountMetadata } from './mappers.js'
import { SubstrateAccountMetadata, SubstrateAccountUpdate } from './types.js'

const ACCOUNT_METADATA_SYNC_TASK = 'task:steward:accounts-metadata-sync'
const AGENT_LEVEL_PREFIX = 'agent:steward'
const ACCOUNTS_LEVEL_PREFIX = 'agent:steward:accounts'
const ACCOUNTS_EVM_LEVEL_PREFIX = 'agent:steward:accounts:evm'

const START_DELAY = 30_000 // 30s
const SCHED_RATE = 43_200_000 // 24h

export class AccountsMetadataManager {
  id = 'steward:accounts'

  readonly #log: Logger
  readonly #sched: Scheduler
  readonly #ingress: SubstrateIngressConsumer

  readonly #db: LevelDB
  readonly #dbAccounts: AbstractSublevel<
    LevelDB,
    string | Buffer | Uint8Array,
    Buffer,
    SubstrateAccountMetadata
  >
  readonly #dbAccountsEvmIndex: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, Buffer, Buffer>

  readonly #cache: LRUCache<string, SubstrateAccountMetadata, unknown>
  readonly #rxSubs: Subscription[] = []

  constructor({ log, db, scheduler, ingress }: StewardManagerContext) {
    this.#log = log
    this.#sched = scheduler
    this.#ingress = ingress.substrate
    this.#db = db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbAccounts = db.sublevel<Buffer, SubstrateAccountMetadata>(ACCOUNTS_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbAccountsEvmIndex = db.sublevel<Buffer, Buffer>(ACCOUNTS_EVM_LEVEL_PREFIX, {
      keyEncoding: 'buffer',
      valueEncoding: 'buffer',
    })
    this.#cache = new LRUCache({
      ttl: 3_600_000,
      ttlResolution: 60_000,
      ttlAutopurge: true,
      max: 1_000,
    })

    this.#sched.on(ACCOUNT_METADATA_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  async start() {
    const alreadyScheduled = await this.#sched.hasScheduled((key) => key.endsWith(ACCOUNT_METADATA_SYNC_TASK))
    if (this.#sched.enabled && ((await this.#isNotScheduled()) || !alreadyScheduled)) {
      await this.#scheduleSync()

      // first-time sync
      this.#log.info('[agent:%s] delayed initial sync in %s', this.id, START_DELAY)
      const timeout = setTimeout(() => {
        this.#syncAccounts()
      }, START_DELAY)
      timeout.unref()
    }

    this.#subscribeHydrationEvmAccountEvents()
  }

  stop() {
    for (const sub of this.#rxSubs) {
      sub.unsubscribe()
    }
  }

  async queries(
    params: QueryParams<StewardQueryArgs>,
  ): Promise<QueryResult<SubstrateAccountMetadata | Empty>> {
    const { args, pagination } = params

    if (args.op === 'accounts') {
      return await this.#fetchAccounts(args.criteria)
    }

    if (args.op === 'accounts.list') {
      const cursor = pagination?.cursor && pagination.cursor !== '' ? pagination.cursor : undefined

      const iterator = this.#dbAccounts.iterator({
        ...(cursor ? { gt: cursor } : {}),
        limit: limitCap(pagination),
      })

      return await paginatedResults<string, SubstrateAccountMetadata>(iterator)
    }

    throw new Error('Unsupported op')
  }

  async #fetchAccounts(criteria: {
    accounts: string[]
  }): Promise<QueryResult<SubstrateAccountMetadata | Empty>> {
    const inputs = criteria.accounts

    const dbKeys = await this.#resolveDbKeysFromInput(criteria)

    const results: (SubstrateAccountMetadata | Empty)[] = new Array(dbKeys.length)
    const keysToFetch: Buffer[] = []
    const fetchIndexes: number[] = []

    for (let i = 0; i < dbKeys.length; i++) {
      const key = dbKeys[i]
      const cacheKey = key.toString('hex')

      const cached = this.#cache.get(cacheKey)
      if (cached) {
        results[i] = cached
      } else {
        keysToFetch.push(key)
        fetchIndexes.push(i)
      }
    }

    if (keysToFetch.length) {
      const fetched = await this.#dbAccounts.getMany<Buffer, SubstrateAccountMetadata>(keysToFetch, {
        /** */
      })

      fetched.forEach((item, fetchIdx) => {
        const resultIndex = fetchIndexes[fetchIdx]
        const originalInput = inputs[resultIndex]

        if (item !== undefined) {
          results[resultIndex] = item
          this.#cache.set(keysToFetch[fetchIdx].toString('hex'), item)
        } else {
          results[resultIndex] = {
            isNotResolved: true,
            query: { account: originalInput },
          }
        }
      })
    }

    return { items: results }
  }

  #syncAccounts() {
    this.#log.info('[agent:%s] START accounts sync', this.id)
    const chainIds = this.#ingress.getChainIds()
    const streams: Observable<SubstrateAccountUpdate>[] = []

    for (const chainId of chainIds) {
      streams.push(identities$(this.#ingress, chainId))
      const extra = extraAccountMeta$[chainId]
      if (extra) {
        streams.push(extra(this.#ingress))
      }
    }

    merge(...streams).subscribe({
      next: async (incoming) => {
        const normalisedPublicKey =
          incoming.publicKey.length > 42 ? incoming.publicKey : toHex(padAccountKey20(incoming.publicKey))
        const pubKeyBuf = Buffer.from(normalisedPublicKey.substring(2).toLowerCase(), 'hex')
        try {
          const persisted = await this.#dbAccounts.get(pubKeyBuf)
          const merged = mergeAccountMetadata(persisted, incoming)

          if (persisted && merged.updatedAt === persisted.updatedAt) {
            return
          }

          await this.#dbAccounts.put(pubKeyBuf, merged)
          for (const evm of merged.evm) {
            const indexKey = Buffer.from(evm.address.substring(2).toLowerCase(), 'hex')
            await this.#dbAccountsEvmIndex.put(indexKey, pubKeyBuf)
          }
        } catch (e) {
          this.#log.error(e, '[agent:%s] on account metadata write (%s)', this.id, incoming.publicKey)
        }
      },
      complete: () => this.#log.info('[agent:%s] END storing accounts', this.id),
      error: (e) => this.#log.error(e, '[agent:%s] on account store', this.id),
    })
  }

  async #onScheduledTask() {
    this.#syncAccounts()
    await this.#scheduleSync()
  }

  async #scheduleSync() {
    const alreadyScheduled = await this.#sched.hasScheduled((key) => key.endsWith(ACCOUNT_METADATA_SYNC_TASK))
    if (alreadyScheduled) {
      this.#log.info('[agent:%s] next sync already scheduled', this.id)
      return
    }
    const time = new Date(Date.now() + SCHED_RATE)
    const timeString = time.toISOString()
    const key = timeString + ACCOUNT_METADATA_SYNC_TASK
    const task = {
      key,
      type: ACCOUNT_METADATA_SYNC_TASK,
      task: null,
    } as Scheduled

    await this.#sched.schedule(task)
    await this.#db.put('scheduled', true)

    this.#log.info('[agent:%s] sync scheduled %s', this.id, timeString)
  }

  async #resolveDbKeysFromInput({ accounts }: { accounts: string[] }): Promise<Buffer[]> {
    const resolved: Buffer[] = []

    for (const input of accounts) {
      if (input.startsWith('0x')) {
        const addressBuf = Buffer.from(input.slice(2).toLowerCase(), 'hex')

        if (addressBuf.length === 20) {
          const indexedPubKey = await this.#dbAccountsEvmIndex.get(addressBuf).catch(() => undefined)

          if (indexedPubKey) {
            resolved.push(indexedPubKey)
          } else {
            const padded = padAccountKey20(input as HexString)
            resolved.push(padded)
          }
        } else if (addressBuf.length === 32) {
          resolved.push(addressBuf)
        } else {
          this.#log.warn('[agent:%s] Invalid hex address length %s', this.id, input)
        }

        continue
      }

      resolved.push(Buffer.from(ss58ToPublicKey(input)))
    }
    return resolved
  }

  // TODO generalise for other networks and pallets, similar to mappers but for updates
  #subscribeHydrationEvmAccountEvents() {
    const chainsToWatch: NetworkURN[] = ['urn:ocn:polkadot:2034']
    const streams = SubstrateSharedStreams.instance(this.#ingress)

    for (const chainId of chainsToWatch) {
      if (!this.#ingress.isNetworkDefined(chainId)) {
        continue
      }

      this.#log.info('[agent:%s] watching for evm account mapping events %s', this.id, chainId)

      this.#rxSubs.push(
        streams
          .blockEvents(chainId)
          .pipe(
            filter((evt) => evt.module.toLowerCase() === 'evmaccounts' && evt.name.toLowerCase() === 'bound'),
          )
          .subscribe(async ({ value: { account, address }, blockNumber }) => {
            try {
              const pubKey = ss58ToPublicKey(account)
              const pubKeyBuf = Buffer.from(pubKey)
              const evmAddress = address.toLowerCase() as HexString
              const evmBuf = Buffer.from(evmAddress.slice(2), 'hex')

              this.#log.info(
                '[agent:%s] evm account bound (chainId=%s, account=%s, evm=%s, block=%s)',
                this.id,
                chainId,
                account,
                evmAddress,
                blockNumber,
              )

              const persisted = await this.#dbAccounts.get(pubKeyBuf).catch(() => undefined)

              const next: SubstrateAccountMetadata = mergeAccountMetadata(persisted, {
                publicKey: toHex(pubKey) as HexString,
                evm: [
                  ...(persisted?.evm ?? []),
                  {
                    chainId,
                    address: evmAddress,
                  },
                ].filter(
                  // dedupe (important on replays)
                  (v, i, arr) =>
                    arr.findIndex((x) => x.chainId === v.chainId && x.address === v.address) === i,
                ),
              })

              await this.#dbAccounts.put(pubKeyBuf, next)
              await this.#dbAccountsEvmIndex.put(evmBuf, pubKeyBuf)
              this.#cache.set(pubKeyBuf.toString('hex'), next)
            } catch (err) {
              this.#log.error(
                err,
                '[agent:%s] failed processing evm bound event (chainId=%s)',
                this.id,
                chainId,
              )
            }
          }),
      )
    }
  }

  async #isNotScheduled() {
    return (await this.#db.get('scheduled:accounts')) === undefined
  }
}

import { AbstractSublevel } from 'abstract-level'
import { toHex } from 'polkadot-api/utils'
import { merge, Observable } from 'rxjs'
import { padAccountKey20 } from '@/common/address.js'
import { asPublicKey } from '@/common/util.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Scheduled, Scheduler } from '@/services/scheduling/scheduler.js'
import { LevelDB, Logger } from '@/services/types.js'
import { StewardManagerContext, StewardQueryArgs } from '../types.js'
import { limitCap, paginatedResults } from '../util.js'
import { extraAccountMeta$, identities$, mergeAccountMetadata, toAccountKey } from './mappers.js'
import { SubstrateAccountMetadata, SubstrateAccountUpdate } from './types.js'

const ACCOUNT_METADATA_SYNC_TASK = 'task:steward:accounts-metadata-sync'
const AGENT_LEVEL_PREFIX = 'agent:steward'
const ACCOUNTS_LEVEL_PREFIX = 'agent:steward:assets'

const START_DELAY = 30_000 // 45s
const SCHED_RATE = 86_400_000 // 24h

export class AccountsMetadataManager {
  id = 'steward:accounts'

  readonly #log: Logger
  readonly #sched: Scheduler
  readonly #ingress: SubstrateIngressConsumer

  readonly #db: LevelDB
  readonly #dbAccounts: AbstractSublevel<
    LevelDB,
    string | Buffer | Uint8Array,
    string,
    SubstrateAccountMetadata
  >

  constructor({ log, db, scheduler, ingress }: StewardManagerContext) {
    this.#log = log
    this.#sched = scheduler
    this.#ingress = ingress.substrate
    this.#db = db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbAccounts = db.sublevel<string, SubstrateAccountMetadata>(ACCOUNTS_LEVEL_PREFIX, {
      valueEncoding: 'json',
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
  }

  stop() {
    // noop
  }

  async queries(params: QueryParams<StewardQueryArgs>): Promise<QueryResult<SubstrateAccountMetadata>> {
    const { args, pagination } = params
    if (args.op === 'accounts') {
      const pubKeys = args.criteria.accounts.map(toAccountKey)
      const fetchedItems = pubKeys.length
        ? (
            await this.#dbAccounts.getMany<string, SubstrateAccountMetadata>(pubKeys, {
              /** */
            })
          ).filter((x) => x !== undefined)
        : []
      return { items: fetchedItems }
    }
    if (args.op === 'accounts.list') {
      const cursor = pagination?.cursor && pagination.cursor !== '' ? pagination.cursor : undefined

      const iterator = this.#dbAccounts.iterator({
        ...(cursor ? { gt: cursor } : {}),
        limit: limitCap(pagination),
      })
      return await paginatedResults<string, SubstrateAccountMetadata>(iterator)
    }
    throw new Error('Unssuported op')
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
        const accountKey =
          incoming.publicKey.length > 42 ? incoming.publicKey : toHex(padAccountKey20(incoming.publicKey))
        try {
          const persisted = await this.#dbAccounts.get(accountKey)
          const merged = mergeAccountMetadata(persisted, incoming)

          if (persisted && merged.updatedAt === persisted.updatedAt) {
            return
          }

          await this.#dbAccounts.put(accountKey, merged)
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

  async #isNotScheduled() {
    return (await this.#db.get('scheduled:accounts')) === undefined
  }
}

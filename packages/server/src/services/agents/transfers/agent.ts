import { Migrator } from 'kysely'
import { Operation } from 'rfc6902'
import {
  Connectable,
  catchError,
  connectable,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
  Subscription as RxSubscription,
  Subject,
} from 'rxjs'
import { asPublicKey, asSerializable, ControlQuery, Criteria, deepCamelize } from '@/common/index.js'
import { Egress } from '@/services/egress/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  getAgentCapabilities,
  Queryable,
  QueryPagination,
  QueryParams,
  QueryResult,
  Subscribable,
} from '../types.js'
import { mapTransferToRow } from './convert.js'
import { createIntrachainTransfersDatabase } from './repositories/db.js'
import { IntrachainTransfersRepository } from './repositories/repository.js'
import { IcTransfer, IcTransferResponse } from './repositories/types.js'
import { TransfersTracker } from './tracker.js'
import {
  $IcTransferQueryArgs,
  $TransfersAgentInputs,
  IcTransferQueryArgs,
  TransferRangeFilters,
  TransfersAgentInputs,
  TransfersFilters,
  TransfersSubscriptionHandler,
} from './types.js'

const TRANSFERS_AGENT_ID = 'transfers'
export const DEFAULT_IC_TRANSFERS_PATH = 'db.ic-transfers.sqlite'

export class TransfersAgent implements Agent, Subscribable, Queryable {
  id = TRANSFERS_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Transfers Agent',
    description: 'Indexes and tracks intra-chain transfers.',
    capabilities: getAgentCapabilities(this),
  }
  querySchema = $IcTransferQueryArgs

  readonly inputSchema = $TransfersAgentInputs
  readonly #log: Logger
  readonly #notifier: Egress
  readonly #repository: IntrachainTransfersRepository
  readonly #migrator: Migrator

  readonly #tracker: TransfersTracker
  readonly #icTransfers$: Connectable<IcTransferResponse>

  readonly #subs: Map<string, TransfersSubscriptionHandler> = new Map()
  #connection?: RxSubscription

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    const { ingress } = ctx

    this.#log = ctx.log
    this.#notifier = ctx.egress
    this.#tracker = new TransfersTracker({
      log: ctx.log,
      ingress: ingress.substrate,
      steward: deps.steward,
      ticker: deps.ticker,
    })

    const filename = resolveDataPath(DEFAULT_IC_TRANSFERS_PATH, ctx.environment?.dataPath)
    this.#log.info('[agent:%s] database at %s', this.id, filename)

    const { db, migrator } = createIntrachainTransfersDatabase(filename)
    this.#migrator = migrator
    this.#repository = new IntrachainTransfersRepository(db)

    const pipeline$ = this.#tracker.transfers$.pipe(
      mergeMap(
        (tf) =>
          from(this.#repository.insertTransfer(mapTransferToRow(tf))).pipe(
            catchError((err) => {
              this.#log.error(
                err,
                '[agent:%s] Error inserting transfer to db (%s #%s-%s)',
                this.id,
                tf.chainId,
                tf.blockNumber,
                tf.event.blockPosition,
              )
              return EMPTY
            }),
          ),
        5,
      ),
      filter(tf => tf !== null),
      map((icTransfer) => deepCamelize<IcTransfer>(icTransfer)),
    )
    this.#icTransfers$ = connectable(pipeline$, {
      connector: () => new Subject<IcTransferResponse>(),
    })

    this.#log.info('[agent:%s] created ', this.id)
  }

  async start(subs: Subscription<TransfersAgentInputs>[] = []) {
    await this.#tracker.start()

    this.#log.info('[agent:%s] starting db migration', this.id)
    const result = await this.#migrator.migrateToLatest()

    if (result.results && result.results.length > 0) {
      this.#log.info('[agent:%s] db migration complete %o', this.id, result.results)
    }

    this.#connection = this.#icTransfers$.connect()

    if (subs.length > 0) {
      this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

      for (const sub of subs) {
        try {
          this.#subs.set(sub.id, this.#monitor(sub))
        } catch (error) {
          this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
        }
      }
    }

    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    if (this.#connection) {
      this.#connection.unsubscribe()
    }
    this.#tracker.stop()
    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    //
  }

  query(params: QueryParams<IcTransferQueryArgs>): Promise<QueryResult> {
    switch (params.args.op) {
      case 'transfers.list':
        return this.listTransfers(params.args.criteria, params.pagination)
      case 'trasnsfers.by_id':
        return this.getTransferById(params.args.criteria)
      case 'transfers.by_id_range':
        return this.listTransfersByRange(params.args.criteria, params.pagination)
      default:
        throw new Error('Unknown query op')
    }
  }

  subscribe(subscription: Subscription<TransfersAgentInputs>) {
    const { id, args } = subscription

    this.#validateNetworks(args)
    const handler = this.#monitor(subscription)

    this.#subs.set(id, handler)
  }

  unsubscribe(id: string) {
    try {
      const handler = this.#subs.get(id)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  async listTransfers(
    filters?: TransfersFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<IcTransferResponse>> {
    // convert address filters to public key for matching
    if (filters?.address) {
      filters.address = asPublicKey(filters.address)
    }
    const result = await this.#repository.listTransfers(filters, pagination)

    return {
      pageInfo: result.pageInfo,
      items: result.nodes.map((tf) => deepCamelize<IcTransfer>(tf)),
    }
  }

  async listTransfersByRange(
    filters: TransferRangeFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<IcTransferResponse>> {
    if (filters.start > filters.end) {
      throw new Error('Invalid transfer range')
    }
    const result = await this.#repository.listTransfersByRange(filters, pagination)

    return {
      pageInfo: result.pageInfo,
      items: result.nodes.map((tf) => deepCamelize<IcTransfer>(tf)),
    }
  }

  async getTransferById({ id }: { id: number }): Promise<QueryResult<IcTransferResponse>> {
    try {
      const transfer = await this.#repository.getTransferById(id)
      return { items: [deepCamelize<IcTransfer>(transfer)] }
    } catch (err) {
      this.#log.error(err, '[%s] Error fetching transfer by id (id=%s)', this.id, id)
      return { items: [] }
    }
  }

  #monitor(subscription: Subscription<TransfersAgentInputs>): TransfersSubscriptionHandler {
    const { id, args } = subscription
    const networksControl = ControlQuery.from(this.#networkCriteria(args.networks))
    const stream = this.#icTransfers$
      .pipe(filter((transfer) => networksControl.value.test(transfer)))
      .subscribe({
        next: (payload) => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            this.#notifier.publish(handler.subscription, {
              metadata: {
                type: 'transfers',
                subscriptionId: id,
                agentId: this.id,
                networkId: payload.network as NetworkURN,
                timestamp: Date.now(),
                blockTimestamp: payload.sentAt,
              },
              payload: asSerializable(payload) as unknown as AnyJson,
            })
          } else {
            // this could happen with closed ephemeral subscriptions
            this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
          }
        },
        complete: () => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            if (handler.subscription.ephemeral) {
              this.#notifier.terminate(handler.subscription)
            }
          }
        },
      })

    return {
      networksControl,
      subscription,
      stream,
    }
  }

  #validateNetworks({ networks }: TransfersAgentInputs) {
    if (networks !== '*') {
      this.#tracker.validateNetworks(networks as NetworkURN[])
    }
  }

  #networkCriteria(networks: string[] | '*'): Criteria {
    if (networks === '*') {
      return {}
    }

    return {
      network: { $in: networks },
    }
  }
}

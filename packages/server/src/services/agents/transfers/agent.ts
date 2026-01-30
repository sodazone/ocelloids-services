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
import { asJSON, asSerializable, ControlQuery, Criteria, deepCamelize } from '@/common/index.js'
import { Egress } from '@/services/egress/index.js'
import { BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { createIntrachainTransfersDatabase } from './repositories/db.js'
import { IntrachainTransfersRepository } from './repositories/repository.js'
import { IcTransfer, IcTransferResponse, NewIcTransfer } from './repositories/types.js'
import { TransfersTracker } from './tracker.js'
import {
  $TransfersAgentInputs,
  EnrichedTransfer,
  TransfersAgentInputs,
  TransfersSubscriptionHandler,
} from './type.js'

const TRANSFERS_AGENT_ID = 'transfers'
export const DEFAULT_IC_TRANSFERS_PATH = 'db.ic-transfers.sqlite'

export function mapTransferToRow(t: EnrichedTransfer): NewIcTransfer {
  const blockPosition = t.event.blockPosition
  const txHash = t.extrinsic ? (t.extrinsic as BlockExtrinsic).hash : undefined
  const evmTxHash = t.extrinsic ? (t.extrinsic as BlockExtrinsic).evmTxHash : undefined

  return {
    network: t.chainId,
    block_number: t.blockNumber,
    block_hash: t.blockHash,
    event_index: blockPosition,
    sent_at: t.timestamp,
    created_at: Date.now(),

    asset: t.asset,
    from: t.from,
    to: t.to,
    from_formatted: t.fromFormatted,
    to_formatted: t.toFormatted,
    amount: t.amount,

    decimals: t.decimals,
    symbol: t.symbol,
    usd: t.volume,

    tx_primary: txHash,
    tx_secondary: evmTxHash,

    event: asJSON(t.event),
    transaction: t.extrinsic ? asJSON(t.extrinsic) : '{}',
  }
}

export class TransfersAgent implements Agent, Subscribable {
  id = TRANSFERS_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Transfers Agent',
    description: 'Indexes and tracks intra-chain transfers.',
    capabilities: getAgentCapabilities(this),
  }

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
        10,
      ),
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

  #networkCriteria(chainIds: string[] | '*'): Criteria {
    if (chainIds === '*') {
      return {}
    }

    return {
      chainId: { $in: chainIds },
    }
  }
}

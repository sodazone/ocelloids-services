import { Subscription as RxSubscription, Subject, share } from 'rxjs'
import { normaliseDecimals } from '@/common/numbers.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { transferStreamMappers } from './streams/index.js'
import { EnrichedTransfer } from './type.js'

export class TransfersTracker {
  readonly #id = 'transfers-tracker'
  readonly #log: Logger
  readonly #ingress: SubstrateIngressConsumer
  readonly #shared: SubstrateSharedStreams
  readonly #steward: DataSteward
  readonly #subject: Subject<EnrichedTransfer>

  readonly #streams: Record<string, RxSubscription> = {}
  readonly transfers$

  constructor(log: Logger, ingress: SubstrateIngressConsumer, steward: DataSteward) {
    this.#log = log
    this.#ingress = ingress
    this.#shared = SubstrateSharedStreams.instance(this.#ingress)
    this.#steward = steward

    this.#subject = new Subject<EnrichedTransfer>()
    this.transfers$ = this.#subject.pipe(share())
  }

  start() {
    const chainIds = this.#ingress.getChainIds()
    for (const chainId of chainIds) {
      this.#subscribeTransfers(chainId)
      this.#log.info('[agent:%s] %s stream subscribed ', this.#id, chainId)
    }
    this.#log.info('[agent:%s] started', this.#id)
  }

  stop() {
    for (const [chainId, sub] of Object.entries(this.#streams)) {
      sub.unsubscribe()
      this.#log.info('[agent:%s] %s stream unsubscribed ', this.#id, chainId)
    }
    this.#log.info('[agent:%s] stopped', this.#id)
  }

  #subscribeTransfers(chainId: NetworkURN) {
    if (this.#streams[chainId]) {
      this.#log.warn('[%s:%s] Transfers already subscribed', this.#id, chainId)
      return
    }
    const mapper = transferStreamMappers[chainId]
    if (!mapper) {
      this.#log.warn('[%s:%s] No mapper defined, skipping...', this.#id, chainId)
      return
    }
    const blockEvents$ = this.#shared.blockEvents(chainId)
    const sub = mapper(blockEvents$).subscribe({
      next: (transfer) => {
        // enrich with categories, asset metadata, asset price etc...
        console.log(
          `[${chainId}] TRANSFER ${normaliseDecimals(transfer.amount, 10)} DOT from ${transfer.from} to ${transfer.to}`,
        )
        this.#subject.next({ ...transfer, chainId })
      },
      error: (err) => this.#log.error(err, '[%s:%s] Error on chain stream', this.#id, chainId),
    })
    this.#streams[chainId] = sub
  }
}

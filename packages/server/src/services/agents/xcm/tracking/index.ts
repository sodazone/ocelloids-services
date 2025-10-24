import { Subject, share } from 'rxjs'
import { ArchiveRepository } from '@/services/archive/repository.js'
import { ArchiveRetentionJob } from '@/services/archive/retention.js'
import { ArchiveRetentionOptions, HistoricalQuery } from '@/services/archive/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../../types.js'
import { xcmMatchingEngineMetrics } from '../telemetry/metrics.js'
import { XcmMessagePayload } from '../types/messages.js'
import { MatchingEngine } from './matching.js'
import { SnowbridgeTracker } from './snowbridge.js'
import { SubstrateXcmTracker } from './substrate.js'

const EXCLUDED_NETWORKS: NetworkURN[] = []

export class XcmTracker {
  readonly #id = 'xcm-tracker'
  readonly #log: Logger
  readonly #engine: MatchingEngine
  readonly #subject: Subject<XcmMessagePayload>
  readonly #chains: { substrate: NetworkURN[]; evm: NetworkURN[] }

  readonly #archive?: ArchiveRepository
  readonly #retentionOpts?: ArchiveRetentionOptions

  readonly #substrateXcmTracker: SubstrateXcmTracker
  readonly #snowbridgeTracker: SnowbridgeTracker

  readonly xcm$

  #retentionJob?: ArchiveRetentionJob

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#archive = ctx.archive
    this.#retentionOpts = ctx.archiveRetention
    this.#chains = {
      substrate: ctx.ingress.substrate.getChainIds().filter((c) => !EXCLUDED_NETWORKS.includes(c)),
      evm: ctx.ingress.evm.getChainIds().filter((c) => !EXCLUDED_NETWORKS.includes(c)),
    }

    this.#subject = new Subject<XcmMessagePayload>()
    this.xcm$ = this.#subject.pipe(share())
    this.#engine = new MatchingEngine(ctx, (msg: XcmMessagePayload) => this.#subject.next(msg))
    this.#substrateXcmTracker = new SubstrateXcmTracker(ctx, this.#engine, this.#canBeMatched.bind(this))
    this.#snowbridgeTracker = new SnowbridgeTracker(ctx, this.#engine, this.#canBeMatched.bind(this))
  }

  start() {
    this.#substrateXcmTracker.start(this.#chains)
    this.#snowbridgeTracker.start(this.#chains)
    this.#initHistoricalData()
  }

  async stop() {
    this.#log.info('[%s] stop', this.#id)

    this.#substrateXcmTracker.stop()
    this.#snowbridgeTracker.stop()
    await this.#engine.stop()
    if (this.#retentionJob !== undefined) {
      this.#retentionJob.stop()
    }
  }

  collectTelemetry() {
    xcmMatchingEngineMetrics(this.#engine)
  }

  historicalXcm$(query: Partial<HistoricalQuery>) {
    return this.#archive ? this.#archive.withHistory(this.xcm$, query) : this.xcm$
  }

  #initHistoricalData() {
    if (this.#archive !== undefined) {
      this.#log.info('[%s] Tracking historical events', this.#id)

      // this.xcm$.subscribe(async (_message) => {
      // await this.#archive?.insertLogs({
      //   network: message.waypoint.chainId,
      //   agent: 'xcm',
      //   block_number: Number(message.waypoint.blockNumber),
      //   payload: JSON.stringify(message),
      // })
      // })

      if (this.#retentionOpts?.enabled) {
        const { policy } = this.#retentionOpts
        this.#retentionJob = new ArchiveRetentionJob(this.#log, this.#archive, policy)

        this.#retentionJob.start()
      } else {
        this.#log.info('[archive:%s] retention job is not enabled', this.#id)
      }
    }
  }

  #canBeMatched(destination: NetworkURN) {
    return this.#chains.substrate.includes(destination) || this.#chains.evm.includes(destination)
  }
}

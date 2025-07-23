import fs from 'fs'
import path from 'path'

import { EMPTY, Observable, Subject, Subscription, defer, from, interval, range } from 'rxjs'
import { catchError, concatMap, delay, map, share, switchMap, tap, zipWith } from 'rxjs/operators'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { matchExtrinsic } from '@/services/agents/xcm/ops/util.js'
import { createNetworkId, getConsensus } from '@/services/config.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { z } from 'zod'
import { RETRY_CAPPED } from '../../watcher.js'
import { BackedCandidate, Block, SubstrateApi } from '../types.js'

const BackfillConfigSchema = z.object({
  start: z.number(),
  end: z.number(),
  paraIds: z.array(z.string()),
})
const BackfillConfigsSchema = z.record(z.string(), BackfillConfigSchema)

type BackfillConfig = z.infer<typeof BackfillConfigSchema>
type BackfillConfigs = z.infer<typeof BackfillConfigsSchema>

const INITIAL_DELAY_MS = 5 * 60 * 1_000
const EMIT_INTERVAL_MS = 1_000

export class SubstrateBackfill {
  readonly #log: Logger
  readonly #chainBlock$ = new Map<string, Observable<Block>>()
  readonly #chainBlockHash$ = new Map<string, Subject<HexString>>()
  readonly #relaySubscriptions = new Map<string, Subscription>()

  readonly #backfillConfig?: BackfillConfigs
  #getApi: (chainId: NetworkURN) => Promise<SubstrateApi>

  constructor(log: Logger, getApi: (chainId: NetworkURN) => Promise<SubstrateApi>) {
    this.#log = log
    this.#backfillConfig = this.#loadConfig(process.env.OC_SUBSTRATE_BACKFILL_FILE)
    this.#getApi = getApi
  }

  getBackfill$(chainId: string) {
    const backfill$ = this.#chainBlock$.get(chainId)
    if (backfill$) {
      return defer(() =>
        backfill$.pipe(
          tap((block) => this.#log.info('[%s] BACKFILL block #%s %s', chainId, block.number, block.hash)),
        ),
      )
    } else {
      return EMPTY
    }
  }

  start() {
    if (!this.#backfillConfig) {
      return
    }

    for (const [relayId, config] of Object.entries(this.#backfillConfig)) {
      // Create para chain streams
      for (const paraId of config.paraIds) {
        this.#initParaChainStream(paraId)
      }

      // Create relay chain block stream
      this.#initRelayChainStream(relayId, config)
    }
  }

  stop() {
    for (const sub of this.#relaySubscriptions.values()) {
      sub.unsubscribe()
    }
    this.#relaySubscriptions.clear()
  }

  #initParaChainStream(paraId: string) {
    const subject = new Subject<HexString>()
    this.#chainBlockHash$.set(paraId, subject)

    const observable$ = subject.pipe(
      concatMap((hash) => {
        return from(this.#getApi(paraId as NetworkURN)).pipe(switchMap((api) => this.#getBlock(api, hash)))
      }),
    )

    this.#chainBlock$.set(paraId, observable$)
  }

  #initRelayChainStream(relayId: string, config: BackfillConfig) {
    const { start, end } = config
    const totalBlocks = end - start + 1

    const relayBlock$ = from(this.#getApi(relayId as NetworkURN)).pipe(
      delay(INITIAL_DELAY_MS),
      switchMap((api) =>
        range(start, totalBlocks).pipe(
          zipWith(interval(EMIT_INTERVAL_MS)),
          map(([blockNumber]) => blockNumber),
          concatMap((blockNumber) => this.#getBlockWithHash(api, relayId, blockNumber)),
        ),
      ),
      share(),
    )

    this.#chainBlock$.set(relayId, relayBlock$)

    this.#relaySubscriptions.set(
      relayId,
      relayBlock$.subscribe((block) => {
        try {
          this.#processRelayBlock(relayId as NetworkURN, block)
        } catch (error) {
          this.#log.error(error, '[%s] Error processing backfill relay block #%s', relayId, block.number)
        }
      }),
    )
  }

  #getBlockWithHash(api: SubstrateApi, relayId: string, blockNumber: number) {
    return defer(() =>
      from(api.getBlockHash(blockNumber)).pipe(
        retryWithTruncatedExpBackoff(RETRY_CAPPED),
        tapError(this.#log, relayId, 'getBlockHash'),
        concatMap((hash) => this.#getBlock(api, hash)),
        catchError((err) => {
          this.#log.warn(err, '[%s] Dropping block %s due to error', relayId, blockNumber)
          return EMPTY
        }),
      ),
    )
  }

  #processRelayBlock(relayId: NetworkURN, block: Block) {
    const paraXt = block.extrinsics.find((xt) => matchExtrinsic(xt, 'ParaInherent', 'enter'))
    const inherentData = paraXt?.args?.data

    if (!Array.isArray(inherentData?.backed_candidates)) {
      this.#log.warn('[%s] Invalid or missing backed_candidates', relayId)
      return
    }

    for (const { candidate } of inherentData.backed_candidates as BackedCandidate[]) {
      const paraId = candidate.descriptor.para_id
      const paraHead = candidate.descriptor.para_head
      const key = createNetworkId(getConsensus(relayId), paraId.toString())

      const paraSubject = this.#chainBlockHash$.get(key)
      if (paraSubject) {
        paraSubject.next(paraHead as HexString)
      }
    }
  }

  #getBlock(api: SubstrateApi, hash: string): Observable<Block> {
    return defer(() => from(api.getBlock(hash, false))).pipe(
      retryWithTruncatedExpBackoff(RETRY_CAPPED),
      map((block): Block => ({ status: 'finalized', ...block })),
      catchError((err) => {
        this.#log.warn(err, '[backfill] Failed to getBlock for %s', hash)
        return EMPTY
      }),
    )
  }

  #loadConfig(filePath?: string): BackfillConfigs | undefined {
    if (!filePath) {
      return
    }

    try {
      const absPath = path.resolve(filePath)
      const content = fs.readFileSync(absPath, 'utf8')
      const parsed = JSON.parse(content)

      const result = BackfillConfigsSchema.safeParse(parsed)
      if (!result.success) {
        this.#log.warn('[backfill] Invalid config format', result.error.format())
        return
      }

      return result.data
    } catch (error: any) {
      this.#log.warn('[backfill] Error loading config', error)
      return
    }
  }
}

function tapError<T>(log: Logger, chainId: string, method: string) {
  return tap<T>({
    error: (e) => {
      log.warn(e, '[%s] error in backfill stream on method=%s', chainId, method)
    },
  })
}

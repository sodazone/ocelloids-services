import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  interval,
  map,
  Observable,
  range,
  Subject,
  Subscription,
  share,
  switchMap,
  timeout,
  timer,
  zipWith,
} from 'rxjs'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { matchExtrinsic } from '@/services/agents/xcm/ops/util.js'
import { createNetworkId, getConsensus } from '@/services/config.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { Backfill, INITIAL_DELAY_MS, tapError } from '../../backfill.js'
import { BackfillConfig } from '../../types.js'
import { RETRY_ONCE } from '../../watcher.js'
import { BackedCandidate, Block, SubstrateApi } from '../types.js'

export class SubstrateBackfill extends Backfill<SubstrateApi, Block> {
  readonly #chainBlockHash$ = new Map<string, Subject<HexString>>()
  readonly #relaySubscriptions = new Map<string, Subscription>()

  constructor(log: Logger, api$: (chainId: NetworkURN) => Observable<SubstrateApi>) {
    super(log, api$)
  }

  start(chains: NetworkURN[]) {
    if (!this.backfillConfig) {
      return
    }

    this.log.info('[backfill:substrate] starting...')
    for (const chainId of chains) {
      const config = this.backfillConfig[chainId]
      if (!config) {
        this.log.warn('[backfill:%s] not configured. Skipping...', chainId)
        continue
      }
      this.log.info(
        '[backfill:%s] Initializing backfill stream blocks %s-%s (emission=%sms)',
        chainId,
        config.start,
        config.end,
        config.emissionRate,
      )

      if (config.paraIds) {
        for (const paraId of config.paraIds) {
          if (!chains.includes(paraId as NetworkURN)) {
            continue
          }
          this.#initParaChainStream(paraId as NetworkURN)
        }

        this.#initRelayChainStream(chainId as NetworkURN, config)
      } else {
        this.#initChainStream(chainId as NetworkURN, config)
      }
    }
    this.log.info('[backfill:substrate] started')
  }

  stop() {
    this.log.info('[backfill:substrate] stopping...')
    for (const sub of this.#relaySubscriptions.values()) {
      sub.unsubscribe()
    }
    this.#relaySubscriptions.clear()
    this.log.info('[backfill:substrate] stopped')
  }

  #initChainStream(chainId: NetworkURN, config: BackfillConfig) {
    const { start, end, emissionRate } = config
    const totalBlocks = end - start + 1

    let first = true

    const chainBlock$ = this.api$(chainId).pipe(
      switchMap((api) => {
        const delay$ = first ? timer(INITIAL_DELAY_MS) : timer(10)
        first = false

        return delay$.pipe(
          switchMap(() =>
            range(start, totalBlocks).pipe(
              zipWith(interval(emissionRate)),
              map(([blockNumber]) => blockNumber),
              concatMap((blockNumber) => this.#getBlockWithHash(api, chainId, blockNumber)),
            ),
          ),
        )
      }),
      share(),
    )

    this.chainBlock$.set(chainId, chainBlock$)
    this.log.info('[backfill:%s] stream initialized', chainId)
    return chainBlock$
  }

  #initParaChainStream(paraId: NetworkURN) {
    const subject = new Subject<HexString>()
    this.#chainBlockHash$.set(paraId, subject)

    const observable$ = this.api$(paraId).pipe(
      switchMap((api) => subject.pipe(concatMap((hash) => this.#getBlock(api, hash)))),
    )

    this.chainBlock$.set(paraId, observable$)
    this.log.info('[backfill:%s] stream initialized', paraId)
  }

  #initRelayChainStream(relayId: NetworkURN, config: BackfillConfig) {
    const relayBlock$ = this.#initChainStream(relayId, config)

    this.#relaySubscriptions.set(
      relayId,
      relayBlock$.subscribe((block) => {
        try {
          this.#processRelayBlock(relayId as NetworkURN, block)
        } catch (error) {
          this.log.error(error, '[%s] Error processing backfill relay block #%s', relayId, block.number)
        }
      }),
    )
  }

  #getBlockWithHash(api: SubstrateApi, relayId: string, blockNumber: number) {
    return defer(() =>
      from(api.getBlockHash(blockNumber)).pipe(
        timeout(10_000),
        retryWithTruncatedExpBackoff(RETRY_ONCE),
        tapError(this.log, relayId, 'getBlockHash'),
        concatMap((hash) => this.#getBlock(api, hash)),
        catchError((err) => {
          this.log.warn(err, '[%s] Dropping block %s due to error', relayId, blockNumber)
          return EMPTY
        }),
      ),
    )
  }

  #processRelayBlock(relayId: NetworkURN, block: Block) {
    const paraXt = block.extrinsics.find((xt) => matchExtrinsic(xt, 'ParaInherent', 'enter'))
    const inherentData = paraXt?.args?.data

    if (!Array.isArray(inherentData?.backed_candidates)) {
      this.log.warn('[%s] Invalid or missing backed_candidates', relayId)
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
      timeout(10_000),
      retryWithTruncatedExpBackoff(RETRY_ONCE),
      map((block): Block => ({ status: 'finalized', ...block })),
      catchError((err) => {
        this.log.warn(err, '[backfill] Failed to getBlock for %s', hash)
        return EMPTY
      }),
    )
  }
}

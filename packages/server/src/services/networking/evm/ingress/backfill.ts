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
  share,
  switchMap,
  timeout,
  timer,
  zipWith,
} from 'rxjs'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { Backfill, INITIAL_DELAY_MS } from '../../backfill.js'
import { BackfillConfig } from '../../types.js'
import { RETRY_ONCE } from '../../watcher.js'
import { EvmApi } from '../client.js'
import { Block } from '../types.js'

export class EvmBackfill extends Backfill<EvmApi, Block> {
  constructor(log: Logger, api$: (chainId: NetworkURN) => Observable<EvmApi>) {
    super(log, api$)
  }

  start(chains: NetworkURN[]) {
    if (!this.backfillConfig) {
      return
    }

    this.log.info('[backfill:evm] starting...')
    for (const chainId of chains) {
      const config = this.backfillConfig[chainId]
      if (!config) {
        this.log.warn('[backfill:%s] not configured. Skipping...')
        continue
      }
      this.log.info(
        '[backfill:%s] Initializing backfill stream blocks %s-%s (emission=%sms)',
        chainId,
        config.start,
        config.end,
        config.emissionRate,
      )
      this.#initChainStream(chainId as NetworkURN, config)
    }
    this.log.info('[backfill:evm] started')
  }

  stop() {
    this.log.info('[backfill:evm] stopped')
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
              concatMap((blockNumber) => this.#getBlock(api, chainId, blockNumber)),
            ),
          ),
        )
      }),
      share(),
    )

    this.chainBlock$.set(chainId, chainBlock$)
    this.log.info('[backfill:%s] stream initialized', chainId)
  }

  #getBlock(api: EvmApi, chainId: string, blockNumber: number): Observable<Block> {
    return defer(() => from(api.getBlockByNumber(blockNumber))).pipe(
      timeout(10_000),
      retryWithTruncatedExpBackoff(RETRY_ONCE),
      catchError((err) => {
        this.log.warn(err, '[backfill:%s] Failed to getBlock for %s', chainId, blockNumber)
        return EMPTY
      }),
    )
  }
}

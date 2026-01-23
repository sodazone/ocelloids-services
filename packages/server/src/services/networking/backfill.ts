import fs from 'fs'
import path from 'path'
import { EMPTY, map, Observable, scan, tap } from 'rxjs'
import { Logger, NetworkURN } from '../types.js'
import { ApiClient, BackfillConfigs, BackfillConfigsSchema } from './types.js'

export const INITIAL_DELAY_MS = 1 * 60 * 1_000

export function tapError<T>(log: Logger, chainId: string, method: string) {
  return tap<T>({
    error: (e) => {
      log.warn(e, '[%s] error in backfill stream on method=%s', chainId, method)
    },
  })
}

export abstract class Backfill<T extends ApiClient, B extends { number: number | string; hash: string }> {
  protected readonly log: Logger
  protected readonly backfillConfig?: BackfillConfigs
  protected readonly chainBlock$ = new Map<string, Observable<B>>()
  protected readonly api$: (chainId: NetworkURN) => Observable<T>

  constructor(log: Logger, api$: (chainId: NetworkURN) => Observable<T>) {
    this.log = log
    this.backfillConfig = this.#loadConfig(process.env.OC_SUBSTRATE_BACKFILL_FILE)
    this.api$ = api$
  }

  getBackfill$(chainId: NetworkURN): Observable<B> {
    const backfill$ = this.chainBlock$.get(chainId)
    if (!backfill$) {
      return EMPTY
    }

    const config = this.backfillConfig![chainId]

    return backfill$.pipe(
      scan(
        (state, block) => {
          if (!config || config.emissionRate > 1_000) {
            this.log.info('[%s] BACKFILL block #%s %s', chainId, block.number, block.hash)
            return { ...state, block }
          }

          const blocks = [...state.blocks, block.number]
          const now = Date.now()

          if (now - state.lastLog > 5_000) {
            this.log.info(
              '[%s] BACKFILL %s blocks (last=%s) [%s]',
              chainId,
              blocks.length,
              blocks[blocks.length - 1],
              blocks.join(', '),
            )
            return { lastLog: now, blocks: [], block }
          }

          return { ...state, blocks, block }
        },
        {
          lastLog: Date.now(),
          blocks: [] as (string | number)[],
          block: null as B | null,
        },
      ),
      map((state) => state.block!),
    )
  }

  start(chains: NetworkURN[]) {
    throw new Error('Not implemented')
  }

  stop() {
    throw new Error('Not implemented')
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
        this.log.warn('[backfill] Invalid config format %j', result.error.format())
        return
      }

      return result.data
    } catch (error: any) {
      this.log.warn(error, '[backfill] Error loading config')
      return
    }
  }
}

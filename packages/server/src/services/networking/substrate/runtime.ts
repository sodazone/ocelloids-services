import { RuntimeContext } from '@polkadot-api/observable-client'
import { LRUCache } from 'lru-cache'
import { fromHex } from 'polkadot-api/utils'
import {
  catchError,
  filter,
  firstValueFrom,
  map,
  Observable,
  race,
  shareReplay,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs'
import { Logger } from '../../types.js'
import { createContextFromOpaqueMetadata, RuntimeApiContext } from './context.js'
import { RpcApi } from './rpc.js'
import { SubstrateApiContext } from './types.js'

const RUNTIME_STREAM_TIMEOUT_MILLIS = 20_000

export async function getRuntimeVersion(runtime: SubstrateApiContext | RuntimeApiContext) {
  const v = (await runtime.getConstant('System', 'Version')) as {
    spec_name: string
    impl_name: string
    authoring_version: number
    spec_version: number
    impl_version: number
  }
  return {
    specName: v.spec_name,
    implName: v.impl_name,
    authoringVersion: v.authoring_version,
    specVersion: v.spec_version,
    implVersion: v.impl_version,
  }
}

export interface RuntimeManager {
  runtime$: Observable<RuntimeApiContext>
  getByVersion: (specVersion: number) => Promise<RuntimeApiContext>
  getCurrent: () => Promise<RuntimeApiContext>
  getRuntimeForBlock: (hash: string) => Promise<RuntimeApiContext>
  init: () => Promise<RuntimeApiContext>
}

/**
 * Creates a Runtime Updates Manager.
 */
export function createRuntimeManager({
  chainId,
  log,
  runtime$,
  rpc,
}: {
  chainId: string
  runtime$: Observable<RuntimeContext | null>
  log: Logger
  rpc: RpcApi
}): RuntimeManager {
  const runtimeCache = new LRUCache<number, RuntimeApiContext>({
    ttl: 3_600_000, // 1 hour
    ttlResolution: 10 * 60 * 1000, // 10 minutes
    ttlAutopurge: true,
    max: 50,
  })

  let currentSpecVersion: number | undefined
  let initPromise: Promise<RuntimeApiContext> | null = null

  async function addToCache(runtime: RuntimeApiContext): Promise<number> {
    const { specVersion } = await getRuntimeVersion(runtime)
    if (!runtimeCache.has(specVersion)) {
      runtimeCache.set(specVersion, runtime)
      log.info('[%s] Cached spec version %s', chainId, specVersion)
    }
    return specVersion
  }

  async function updateCurrentRuntime(runtime: RuntimeApiContext): Promise<number> {
    const specVersion = await addToCache(runtime)
    currentSpecVersion = specVersion
    log.debug?.('[%s] Updated current spec version to %s', chainId, specVersion)
    return specVersion
  }

  const shared$ = runtime$.pipe(
    filter((rt): rt is RuntimeContext => !!rt),
    map((rt) => new RuntimeApiContext(rt, chainId)),
    tap((runtime) => {
      void updateCurrentRuntime(runtime)
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  async function fallbackRuntime(): Promise<RuntimeApiContext> {
    log.warn('[%s] Fallback to runtime call get metadata', chainId)
    const metadata = await Promise.race([
      rpc.getMetadata(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Runtime call get metadata failed')), 20_000),
      ),
    ])
    return createContextFromOpaqueMetadata(fromHex(metadata), chainId)
  }

  async function loadInitialRuntime(): Promise<RuntimeApiContext> {
    try {
      return await firstValueFrom(
        race([
          shared$.pipe(take(1)),
          timer(RUNTIME_STREAM_TIMEOUT_MILLIS).pipe(switchMap(fallbackRuntime)),
        ]).pipe(
          catchError((err) => {
            log.error(err, '[%s] Error in load initial runtime', chainId)
            throw err
          }),
        ),
      )
    } catch (err) {
      currentSpecVersion = undefined
      throw err
    }
  }

  async function getRuntimeForBlock(blockHash: string): Promise<RuntimeApiContext> {
    const version = await rpc.getSpecVersionAt(blockHash)
    const existing = runtimeCache.get(version)
    if (existing) {
      return existing
    }

    log.info('[%s] Backfill spec version %s', chainId, version)
    const meta = await rpc.getMetadata(blockHash)
    const ctx = createContextFromOpaqueMetadata(fromHex(meta), chainId)
    await addToCache(ctx)
    return ctx
  }

  async function ensureRuntimeLoaded(): Promise<RuntimeApiContext> {
    if (currentSpecVersion === undefined) {
      if (!initPromise) {
        initPromise = (async () => {
          const ctx = await loadInitialRuntime()
          await updateCurrentRuntime(ctx)
          initPromise = null
          return ctx
        })()
      }
      return initPromise
    }

    const cached = runtimeCache.get(currentSpecVersion)
    if (cached) {
      return cached
    }

    log.warn('[%s] Reloading current runtime (evicted from cache)', chainId)
    const metadata = await rpc.getMetadata()
    const ctx = createContextFromOpaqueMetadata(fromHex(metadata), chainId)
    await updateCurrentRuntime(ctx)
    return ctx
  }

  async function getByVersion(specVersion: number): Promise<RuntimeApiContext> {
    const rt = runtimeCache.get(specVersion)
    if (rt !== undefined) {
      return rt
    }

    log.warn(
      '[%s] Backfilling runtime for version %s - metadata may not match the requested version',
      chainId,
      specVersion,
    )

    const meta = await rpc.getMetadata()
    const ctx = createContextFromOpaqueMetadata(fromHex(meta), chainId)
    runtimeCache.set(specVersion, ctx)
    return ctx
  }

  return {
    runtime$: shared$,
    getByVersion,
    getCurrent: ensureRuntimeLoaded,
    init: ensureRuntimeLoaded,
    getRuntimeForBlock,
  }
}

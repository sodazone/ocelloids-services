import { RuntimeContext } from '@polkadot-api/observable-client'
import { fromHex } from 'polkadot-api/utils'
import { Observable, filter, firstValueFrom, map, race, shareReplay, take, tap, timer } from 'rxjs'

import { Logger } from '../../types.js'
import { RuntimeApiContext, createRuntimeApiContext } from './context.js'
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
  getCurrent: () => Promise<RuntimeApiContext>
  getRuntimeForBlock: (hash: string) => Promise<RuntimeApiContext>
  init: () => Promise<RuntimeApiContext>
  updateCache: (runtime: RuntimeApiContext) => void
}

/**
 * Creates a Runtime Updates Manager.
 *
 * NOTE: we cannot rely on the follow heads streams to update the runtimes,
 * since we need to support backfilling and catch ups.
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
  const runtimeCache = new Map<number, RuntimeApiContext>()
  let currentRuntime: Promise<RuntimeApiContext> | undefined

  function updateCache(runtime: RuntimeApiContext) {
    getRuntimeVersion(runtime)
      .then((v) => {
        runtimeCache.set(v.specVersion, runtime)
        log.info('[%s] Updated spec version %O', chainId, v)
      })
      .catch((e) => log.error(e))
  }

  const shared$ = runtime$.pipe(
    filter((rt): rt is RuntimeContext => !!rt),
    map((rt) => new RuntimeApiContext(rt, chainId)),
    tap((runtime) => updateCache(runtime)),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  async function loadInitialRuntime(): Promise<RuntimeApiContext> {
    try {
      return await firstValueFrom(
        race([
          shared$.pipe(take(1)),
          timer(RUNTIME_STREAM_TIMEOUT_MILLIS).pipe(
            map(async () => {
              log.warn('[%s] Fallback to state_getMetadata', chainId)
              const metadata = await rpc.getMetadata()
              return createRuntimeApiContext(fromHex(metadata), chainId)
            }),
          ),
        ]),
      )
    } catch (err) {
      currentRuntime = undefined
      throw err
    }
  }

  async function getRuntimeForBlock(blockHash: string): Promise<RuntimeApiContext> {
    const version = await rpc.getSpecVersionAt(blockHash)
    if (!runtimeCache.has(version)) {
      const meta = await rpc.getMetadata(blockHash)
      runtimeCache.set(version, createRuntimeApiContext(fromHex(meta), chainId))
    }
    return runtimeCache.get(version)!
  }

  function ensureRuntimeLoaded(): Promise<RuntimeApiContext> {
    if (!currentRuntime) {
      currentRuntime = (async () => {
        const ctx = await loadInitialRuntime()
        updateCache(ctx)
        return ctx
      })()
    }
    return currentRuntime
  }

  return {
    runtime$: shared$,
    getCurrent: ensureRuntimeLoaded,
    init: ensureRuntimeLoaded,
    updateCache,
    getRuntimeForBlock,
  }
}

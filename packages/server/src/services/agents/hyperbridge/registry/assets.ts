import { AbstractSublevel } from 'abstract-level'
import { Binary } from 'polkadot-api'
import {
  bufferCount,
  EMPTY,
  expand,
  filter,
  map,
  merge,
  mergeMap,
  Observable,
  reduce,
  shareReplay,
  switchMap,
} from 'rxjs'
import { HexString } from '@/lib.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Scheduled, Scheduler } from '@/services/scheduling/scheduler.js'
import { LevelDB, Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../../types.js'
import { HYPERBRIDGE_CONFIG, HYPERBRIDGE_NETWORK_ID } from '../config.js'
import { AssetMapper, AssetMetadata, getAssetMappers, TokenGovernorAsset } from './mappers.js'

const HYPERBRIDGE_ASSET_SYNC_TASK = 'task:hyperbridge:assets-sync'
const ASSETS_LEVEL_PREFIX = 'agent:hyperbridge:assets'

const START_DELAY = 60_000 // 1 min
const SCHED_RATE = 86_400_000 // 24h
const STORAGE_PAGE_LEN = 100

export class HyperbridgeAssetsRegistry {
  readonly #id = 'hyperbridge-registry'
  readonly #log: Logger
  readonly #ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
  readonly #sched: Scheduler

  readonly #mappers: Record<string, AssetMapper>
  readonly #db: LevelDB<string, any>
  readonly #dbAssets: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetMetadata>

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = {
      evm: ctx.ingress.evm,
      substrate: ctx.ingress.substrate,
    }
    this.#sched = ctx.scheduler

    this.#mappers = getAssetMappers({
      log: this.#log,
      ingress: this.#ingress,
    })

    this.#db = ctx.openLevelDB<string, any>('hyperbridge:assets', { valueEncoding: 'json' })
    this.#dbAssets = this.#db.sublevel<string, AssetMetadata>(ASSETS_LEVEL_PREFIX, { valueEncoding: 'json' })

    this.#sched.on(HYPERBRIDGE_ASSET_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  async start() {
    if (!this.#ingress.substrate.isNetworkDefined(HYPERBRIDGE_NETWORK_ID)) {
      this.#log.info('[agent:%s] Hyperbridge network is not configured in config, skipping start', this.#id)
      return
    }

    const alreadyScheduled = await this.#sched.hasScheduled((key) =>
      key.endsWith(HYPERBRIDGE_ASSET_SYNC_TASK),
    )
    if (this.#sched.enabled && ((await this.#isNotScheduled()) || !alreadyScheduled)) {
      await this.#scheduleSync()

      // first-time sync
      this.#log.info('[agent:%s] delayed initial sync in %s', this.#id, START_DELAY)
      const timeout = setTimeout(() => {
        this.#syncAssetMetadata()
      }, START_DELAY)
      timeout.unref()
    }
  }

  stop() {
    //
  }

  async fetchMetadata(chainId: NetworkURN, assetId: HexString): Promise<AssetMetadata> {
    const key = `${chainId}|${assetId}`

    const data = await this.#dbAssets.get(key)
    if (data) {
      return data
    }

    throw new Error(`Unable to fetch metadata for asset ${key}`)
  }

  async #onScheduledTask() {
    this.#syncAssetMetadata()
    await this.#scheduleSync()
  }

  async #scheduleSync() {
    const alreadyScheduled = await this.#sched.hasScheduled((key) =>
      key.endsWith(HYPERBRIDGE_ASSET_SYNC_TASK),
    )
    if (alreadyScheduled) {
      this.#log.info('[agent:%s] next sync already scheduled', this.#id)
      return
    }
    const time = new Date(Date.now() + SCHED_RATE)
    const timeString = time.toISOString()
    const key = timeString + HYPERBRIDGE_ASSET_SYNC_TASK
    const task = {
      key,
      type: HYPERBRIDGE_ASSET_SYNC_TASK,
      task: null,
    } as Scheduled

    await this.#sched.schedule(task)
    await this.#db.put('scheduled', true)

    this.#log.info('[%s] sync scheduled %s', this.#id, timeString)
  }

  #syncAssetMetadata() {
    const substrateMaps = this.#syncSubstrateAssets()
    const evmMaps = this.#syncEvmAssets()

    merge(...substrateMaps, ...evmMaps)
      .pipe(
        bufferCount(100),
        filter((batch) => batch.length > 0),
      )
      .subscribe({
        next: async (batch) => {
          const keys = batch.map((a) => a.key)
          const existing = await this.#dbAssets.getMany(keys)
          const ops = []

          for (let i = 0; i < batch.length; i++) {
            const incoming = batch[i]
            const stored = existing[i]

            const mergedSymbol = stored?.symbol ?? incoming.symbol
            const mergedDecimals = stored?.decimals ?? incoming.decimals

            if (!stored && mergedSymbol === undefined && mergedDecimals === undefined) {
              continue
            }

            // Skip if merged result is identical
            if (!(mergedSymbol !== stored?.symbol) && !(mergedDecimals !== stored?.decimals)) {
              continue
            }

            ops.push({
              type: 'put' as const,
              key: incoming.key,
              value: {
                symbol: mergedSymbol,
                decimals: mergedDecimals,
              },
            })
          }

          if (ops.length === 0) {
            return
          }

          await this.#dbAssets.batch(ops)
        },
        complete: () => this.#log.info('[%s] sync assets complete', this.#id),
        error: (e) => this.#log.error(e, '[%s] metadata sync error', this.#id),
      })
  }

  #fetchAssets(): Observable<TokenGovernorAsset[]> {
    const apis = this.#ingress.substrate

    return apis.getContext(HYPERBRIDGE_NETWORK_ID).pipe(
      switchMap((ctx) => {
        const codec = ctx.storageCodec('TokenGovernor', 'AssetMetadatas')
        const keyPrefix = codec.keys.enc() as HexString

        return apis.getStorageKeys(HYPERBRIDGE_NETWORK_ID, keyPrefix, STORAGE_PAGE_LEN).pipe(
          expand((keys) =>
            keys.length === STORAGE_PAGE_LEN
              ? apis.getStorageKeys(
                  HYPERBRIDGE_NETWORK_ID,
                  keyPrefix,
                  STORAGE_PAGE_LEN,
                  keys[keys.length - 1],
                )
              : EMPTY,
          ),
          reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          mergeMap((keys) =>
            apis.queryStorageAt(HYPERBRIDGE_NETWORK_ID, keys).pipe(
              map((changeSets) => {
                const changes = changeSets[0]?.changes ?? []
                return changes
                  .map(([storageKey, rawValue]) => {
                    if (!rawValue) {
                      return null
                    }
                    const decodedKeyArgs = codec.keys.dec(storageKey) as [Binary]
                    const decodedValue = codec.value.dec(rawValue) as { name: Binary; symbol: Binary }
                    return {
                      assetId: decodedKeyArgs[0].asHex(),
                      name: decodedValue.name.asText(),
                      symbol: decodedValue.symbol.asText(),
                    }
                  })
                  .filter((a) => a !== null)
              }),
            ),
          ),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
  }

  #syncSubstrateAssets() {
    const allAssetMaps = []

    const chainIds = HYPERBRIDGE_CONFIG.networks.substrate

    for (const chainId of chainIds) {
      if (!this.#ingress.substrate.isNetworkDefined(chainId)) {
        continue
      }
      const mapper = this.#mappers[chainId]
      if (mapper) {
        this.#log.info('[%s] Mapping assets for %s', this.#id, chainId)
        allAssetMaps.push(mapper(chainId, this.#fetchAssets()))
      } else {
        this.#log.warn('[%s] No asset mapper found for %s', this.#id, chainId)
      }
    }

    return allAssetMaps
  }

  #syncEvmAssets() {
    const allAssetMaps = []

    const chainIds = HYPERBRIDGE_CONFIG.networks.evm

    for (const chainId of chainIds) {
      if (!this.#ingress.evm.isNetworkDefined(chainId)) {
        continue
      }
      const mapper = this.#mappers[chainId]
      if (mapper) {
        this.#log.info('[%s] Mapping assets for %s', this.#id, chainId)
        allAssetMaps.push(mapper(chainId, this.#fetchAssets()))
      } else {
        this.#log.warn('[%s] No asset mapper found for %s', this.#id, chainId)
      }
    }

    return allAssetMaps
  }

  async #isNotScheduled() {
    return (await this.#db.get('scheduled')) === undefined
  }
}

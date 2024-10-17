import { AbstractSublevel } from 'abstract-level'
import { EMPTY, expand, map, merge, mergeAll, mergeMap, reduce, switchMap } from 'rxjs'
import { z } from 'zod'

import { Twox128 } from '@polkadot-api/substrate-bindings'
import { mergeUint8 } from '@polkadot-api/utils'

import { IngressConsumer, NetworkInfo } from '@/services/ingress/index.js'
import { Scheduled, Scheduler } from '@/services/persistence/level/scheduler.js'
import { LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { HexString } from '@/lib.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  getAgentCapabilities,
} from '../types.js'

import { TextEncoder } from 'util'
import { asSerializable } from '../base/util.js'
import { mappers } from './mappers.js'
import { Queries } from './queries/index.js'
import {
  $StewardQueryArgs,
  AssetId,
  AssetMapper,
  AssetMapping,
  AssetMetadata,
  StewardQueryArgs,
} from './types.js'
import { assetMetadataKey } from './util.js'

const ASSET_METADATA_SYNC_TASK = 'task:steward:assets-metadata-sync'
const AGENT_LEVEL_PREFIX = 'agent:steward'
const ASSETS_LEVEL_PREFIX = 'agent:steward:assets'
const ASSETS_MAP_TMP_LEVEL_PREFIX = 'agent:steward:assets-map-tmp'
const CHAIN_INFO_LEVEL_PREFIX = 'agent:steward:chains'

const STORAGE_PAGE_LEN = 100

const START_DELAY = 30_000 // 5m
const SCHED_RATE = 43_200_000 // 12h

const textEncoder = new TextEncoder()

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable {
  readonly #log: Logger

  readonly #sched: Scheduler
  readonly #ingress: IngressConsumer

  readonly #db: LevelDB
  readonly #dbAssets: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetMetadata>
  readonly #dbChains: LevelDB
  readonly #dbAssetsMapTmp: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, Uint8Array, AssetId>

  readonly #queries: Queries

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#sched = ctx.scheduler
    this.#ingress = ctx.ingress
    this.#db = ctx.db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbAssets = ctx.db.sublevel<string, AssetMetadata>(ASSETS_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbAssetsMapTmp = ctx.db.sublevel<Uint8Array, AssetId>(ASSETS_MAP_TMP_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbChains = ctx.db.sublevel<string, NetworkInfo>(CHAIN_INFO_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#queries = new Queries(this.#dbAssets, this.#dbChains, this.#ingress)

    this.#sched.on(ASSET_METADATA_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  get querySchema(): z.ZodSchema {
    return $StewardQueryArgs
  }

  async query(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    return this.#queries.dispatch(params)
  }

  get id(): string {
    return 'steward'
  }

  get metadata(): AgentMetadata {
    return {
      name: 'Data Steward',
      description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
      capabilities: getAgentCapabilities(this),
    }
  }

  stop() {
    //
  }

  async start() {
    if (this.#sched.enabled && (await this.#isNotScheduled())) {
      await this.#scheduleSync()

      // first-time sync
      this.#log.info('[agent:%s] delayed initial sync in %s', this.id, START_DELAY)
      const timeout = setTimeout(() => {
        this.#syncAssetMetadata()
      }, START_DELAY)
      timeout.unref()
    }
  }

  collectTelemetry() {
    // TODO: impl telemetry
  }

  async #scheduleSync() {
    const time = new Date(Date.now() + SCHED_RATE)
    const timeString = time.toISOString()
    const key = timeString + ASSET_METADATA_SYNC_TASK
    const task = {
      key,
      type: ASSET_METADATA_SYNC_TASK,
      task: null,
    } as Scheduled

    await this.#sched.schedule(task)
    await this.#db.put('scheduled', true)

    this.#log.info('[agent:%s] sync scheduled %s', this.id, timeString)
  }

  async #onScheduledTask() {
    this.#syncAssetMetadata()
    await this.#scheduleSync()
  }

  #syncAssetMetadata() {
    const chainIds = this.#ingress.getChainIds()
    const allAssetMaps = []

    for (const chainId of chainIds) {
      const mapper = mappers[chainId]
      if (mapper) {
        this.#log.info('[agent:%s] GET chain properties (chainId=%s)', this.id, chainId)
        this.#putChainProps(chainId, mapper)

        allAssetMaps.push(this.#map(chainId, mapper))
      }
    }

    const allAssetMapsObs = merge(allAssetMaps).pipe(mergeAll())
    allAssetMapsObs.subscribe({
      next: async ({ chainId, asset }) => {
        const serializableAsset = asSerializable(asset)
        const assetKey = assetMetadataKey(chainId, asset.id)

        /*const multilocation = asset.multiLocation
        if (multilocation) {
         // TODO: handle multi location specific indexing
        }*/

        this.#dbAssets.put(assetKey, serializableAsset).catch((e) => {
          this.#log.error(
            e,
            '[agent:%s] on metadata write (chainId=%s, assetId=%s)',
            this.id,
            chainId,
            asset.id,
          )
        })
      },
      complete: async () => {
        this.#log.info('[agent:%s] END synchronizing asset metadata', this.id)
        const zeroArray = new Uint8Array(8).fill(0)
        const fArray = new Uint8Array(8).fill(0xff)
        for await (const [assetKey, asset] of this.#dbAssets.iterator()) {
          const assetHash = Twox128(textEncoder.encode(assetKey))
          try {
            const externalIdsMap = await this.#dbAssetsMapTmp
              .iterator({
                gt: mergeUint8(assetHash, zeroArray),
                lt: mergeUint8(assetHash, fArray),
              })
              .all()
            const externalIds = externalIdsMap.map(([_key, assetId]) => assetId)
            if (externalIds.length > 0) {
              this.#dbAssets.put(assetKey, {
                ...asset,
                externalIds,
              })
            }
          } catch (_error) {
            //
          }
        }
        this.#log.info('[agent:%s] END synchronizing registered chains', this.id)
        await this.#dbAssetsMapTmp.clear()
      },
      error: (e) => this.#log.error(e, '[agent:%s] on metadata sync', this.id),
    })
  }

  #putChainProps(chainId: NetworkURN, mapper: AssetMapper) {
    this.#ingress
      .getChainInfo(chainId)
      .then((chainInfo) => {
        this.#dbChains.put(chainId, chainInfo).catch((e) => {
          this.#log.error(e, '[agent:%s] while writing chain info (chainId=%s)', this.id, chainId)
        })

        const batch = this.#dbAssets.batch()

        for (let i = 0; i < chainInfo.chainTokens.length; i++) {
          const symbol = chainInfo.chainTokens[i].toString()
          const id = i === 0 ? 'native' : 'native:' + symbol
          const asset: AssetMetadata = {
            id,
            // id native(aaee) index(u8)
            xid: `0xaaee${i.toString(16).padStart(2, '0')}`,
            updated: Date.now(),
            symbol,
            decimals: chainInfo.chainDecimals[i],
            chainId,
            existentialDeposit: chainInfo.existentialDeposit,
            externalIds: [],
            raw: {
              native: true,
            },
          }
          batch.put(assetMetadataKey(chainId, asset.id), asset)
        }
        batch.write().catch((e) => {
          this.#log.error(e, '[agent:%s] while writing chain assets (chainId=%s)', this.id, chainId)
        })
      })
      .catch((e) => {
        this.#log.error(e, '[agent:%s] while fetching chain info (chainId=%s)', this.id, chainId)
      })
  }

  #map(chainId: NetworkURN, mapper: AssetMapper) {
    return this.#ingress.getContext(chainId).pipe(
      switchMap((context) => mapper(context).entries()),
      mergeMap(([index, mapping]) => {
        this.#log.info(
          '[agent:%s] START synchronizing asset metadata (chainId=%s,mapping=%s)',
          this.id,
          chainId,
          index,
        )
        const { keyPrefix, mapEntry } = mapping
        return this.#ingress
          .getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN)
          .pipe(
            expand((keys) =>
              keys.length === STORAGE_PAGE_LEN
                ? this.#ingress.getStorageKeys(chainId, keyPrefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
                : EMPTY,
            ),
            reduce((acc, current) => (current.length > 0 ? acc.concat(current) : acc), [] as HexString[]),
          )
          .pipe(
            mergeMap((keys) => {
              return keys.map((key) =>
                this.#ingress.getStorage(chainId, key).pipe(mapEntry(key, this.#ingress)),
              )
            }),
            mergeAll(),
            map((asset) => ({
              asset,
              chainId,
            })),
          )
      }),
    )
  }

  async #isNotScheduled() {
    try {
      await this.#db.get('scheduled')
      return false
    } catch {
      return true
    }
  }
}

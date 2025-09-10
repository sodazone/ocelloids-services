import { AbstractSublevel } from 'abstract-level'
import {
  EMPTY,
  Observable,
  Observer,
  Subscription,
  expand,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  mergeAll,
  mergeMap,
  reduce,
  switchMap,
} from 'rxjs'

import {
  SubstrateIngressConsumer,
  SubstrateNetworkInfo,
} from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Scheduled, Scheduler } from '@/services/scheduling/scheduler.js'
import { LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { asSerializable } from '@/common/util.js'
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

import { mappers } from './mappers.js'
import { assetOverrides } from './overrides.js'
import { Queries } from './queries/index.js'
import {
  $StewardQueryArgs,
  AssetBalance,
  AssetId,
  AssetIds,
  AssetMapper,
  AssetMetadata,
  StewardQueryArgs,
} from './types.js'
import { assetMetadataKey } from './util.js'

const ASSET_METADATA_SYNC_TASK = 'task:steward:assets-metadata-sync'
const AGENT_LEVEL_PREFIX = 'agent:steward'
const ASSETS_LEVEL_PREFIX = 'agent:steward:assets'
const CHAIN_INFO_LEVEL_PREFIX = 'agent:steward:chains'
const BALANCES_LEVEL_PREFIX = 'agent:steward:balances'

const STORAGE_PAGE_LEN = 100

const START_DELAY = 30_000 // 30s
const SCHED_RATE = 43_200_000 // 12h

const ASSET_PALLET_EVENTS = [
  'Created',
  'Issued',
  'Burned',
  'Destroyed',
  // 'Blocked',
  // 'Thawed',
  // 'Frozen',
  'MetadataCleared',
  'MetadataSet',
  'OwnerChanged',
  'TeamCheanged',
  'AssetStatusChanged',
  'AssetFrozen',
  'AssetThawed',
]

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable {
  id = 'steward'

  querySchema = $StewardQueryArgs

  metadata: AgentMetadata = {
    name: 'Data Steward',
    description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #log: Logger

  readonly #sched: Scheduler
  readonly #ingress: SubstrateIngressConsumer

  readonly #db: LevelDB
  readonly #dbAssets: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetMetadata>
  readonly #dbChains: LevelDB
  readonly #dbBalances: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetBalance>

  readonly #queries: Queries
  readonly #rxSubs: Subscription[] = []

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#sched = ctx.scheduler
    this.#ingress = ctx.ingress.substrate
    this.#db = ctx.db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbAssets = ctx.db.sublevel<string, AssetMetadata>(ASSETS_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbChains = ctx.db.sublevel<string, SubstrateNetworkInfo>(CHAIN_INFO_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbBalances = ctx.db.sublevel<string, AssetBalance>(BALANCES_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#queries = new Queries(this.#dbAssets, this.#dbChains, this.#ingress)

    this.#sched.on(ASSET_METADATA_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  async query(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    return this.#queries.dispatch(params)
  }

  stop() {
    for (const sub of this.#rxSubs) {
      sub.unsubscribe()
    }
  }

  async start() {
    await this.#ingress.isReady()

    if (this.#sched.enabled && (await this.#isNotScheduled())) {
      await this.#scheduleSync()

      // first-time sync
      this.#log.info('[agent:%s] delayed initial sync in %s', this.id, START_DELAY)
      const timeout = setTimeout(() => {
        this.#syncAssetMetadata()
      }, START_DELAY)
      timeout.unref()
    }

    this.#subscribeAssetMetadataEvents()
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
    const allAssetMaps = [this.#mapOverrides()]

    for (const chainId of chainIds) {
      const mapper = mappers[chainId]
      if (mapper) {
        this.#log.info('[agent:%s] GET chain properties (chainId=%s)', this.id, chainId)
        this.#putChainProps(chainId)

        allAssetMaps.push(this.#map(chainId, mapper))
      }
    }

    const allAssetMapsObs = merge(...allAssetMaps)
    allAssetMapsObs.subscribe(this.#storeAssetMetadata())
  }

  #subscribeAssetMetadataEvents() {
    // TODO generalise for other networks and pallets, similar to mappers but for updates
    const chainsToWatch: NetworkURN[] = ['urn:ocn:polkadot:1000', 'urn:ocn:kusama:1000', 'urn:ocn:paseo:1000']
    const streams = SubstrateSharedStreams.instance(this.#ingress)

    for (const chainId of chainsToWatch) {
      if (this.#ingress.isNetworkDefined(chainId)) {
        this.#log.info('[agent:%s] watching for asset updates %s', this.id, chainId)
        this.#rxSubs.push(
          streams
            .blockEvents(chainId)
            .pipe(
              filter(
                (blockEvent) =>
                  blockEvent.module === 'Assets' && ASSET_PALLET_EVENTS.includes(blockEvent.name),
              ),
            )
            .subscribe(async ({ name, value: { asset_id }, blockNumber }) => {
              this.#log.info(
                '[agent:%s] asset update (event=%s, chainId=%s, assetId=%s, block=%s)',
                this.id,
                name,
                chainId,
                asset_id,
                blockNumber,
              )
              if (name === 'Destroyed') {
                await this.#removeAsset(chainId, asset_id)
              } else {
                await this.#updateAsset(chainId, asset_id)
              }
            }),
        )
      }
    }
  }

  async #updateAsset(chainId: NetworkURN, assetId: AssetId) {
    try {
      const context = await firstValueFrom(this.#ingress.getContext(chainId))
      const mappings = mappers[chainId](context)
      const { mapEntry } = mappings[0]

      const codec = context.storageCodec('Assets', 'Asset')
      const key = codec.keys.enc(assetId) as HexString
      const asset = await firstValueFrom(
        this.#ingress.getStorage(chainId, key).pipe(
          mapEntry(key, this.#ingress),
          map((x) => asSerializable<AssetMetadata>(x)),
        ),
      )

      const assetKey = assetMetadataKey(chainId, asset.id)
      const current = await this.#dbAssets.get(assetKey)
      if (current === undefined) {
        await this.#dbAssets.put(assetKey, asset)
      } else {
        await this.#dbAssets.put(assetKey, {
          ...asset,
          externalIds: current.externalIds,
          sourceId: current.sourceId,
        })
      }
    } catch (error) {
      this.#log.error(error, '[agent:%s] on update asset (chainId=%s, assetId=%s)', this.id, chainId, assetId)
    }
  }

  async #removeAsset(chainId: NetworkURN, assetId: AssetId) {
    try {
      const key = assetMetadataKey(chainId, assetId)
      await this.#dbAssets.del(key)
      this.#log.info('[agent:%s] delete asset (chainId=%s, assetId=%s)', this.id, chainId, assetId)
      // remove asset from external ID mappings
      for await (const [assetKey, asset] of this.#dbAssets.iterator()) {
        const updatedIds = [...asset.externalIds]
        const externalIdIndex = updatedIds.findIndex(
          (extId) => extId.chainId === chainId && extId.id === assetId,
        )
        if (externalIdIndex > -1) {
          updatedIds.splice(externalIdIndex, 1)
          await this.#dbAssets.put(assetKey, {
            ...asset,
            externalIds: updatedIds,
          })
          this.#log.info(
            '[agent:%s] update external IDs (chainId=%s, assetId=%s)',
            this.id,
            asset.chainId,
            asset.id,
          )
        }
      }
    } catch (error) {
      this.#log.error(
        error,
        '[agent:%s] on destroy asset (chainId=%s, assetId=%s)',
        this.id,
        chainId,
        assetId,
      )
    }
  }

  #storeAssetMetadata() {
    const tmpMapExternalIds: Record<string, AssetIds[]> = {}
    const tmpMapSourceIds: Record<string, string> = {}

    return {
      next: async ({ chainId, asset }) => {
        const assetKey = assetMetadataKey(chainId, asset.id)
        const multilocation = asset.multiLocation

        if (multilocation) {
          const resolvedId = await this.#queries.resolveAssetIdFromLocation(
            chainId,
            JSON.stringify(multilocation),
          )

          if (resolvedId && resolvedId !== assetKey) {
            const cur = tmpMapExternalIds[resolvedId] ?? []
            tmpMapExternalIds[resolvedId] = cur.concat([
              {
                id: asset.id,
                xid: asset.xid,
                chainId,
              },
            ])

            tmpMapSourceIds[assetKey] = resolvedId
          }
        }

        this.#dbAssets.put(assetKey, asSerializable(asset)).catch((e) => {
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
        for await (const [assetKey, asset] of this.#dbAssets.iterator()) {
          try {
            let updated = false
            const updatedAsset = asset

            const externalIds = tmpMapExternalIds[assetKey]
            if (externalIds) {
              updatedAsset.externalIds = externalIds
              updated = true
            }

            const sourceId = tmpMapSourceIds[assetKey]
            if (sourceId) {
              const sourceAsset = await this.#dbAssets.get(sourceId)
              if (sourceAsset !== undefined) {
                updatedAsset.sourceId = {
                  chainId: sourceAsset.chainId,
                  id: sourceAsset.id,
                  xid: sourceAsset.xid,
                }
                updated = true
              }
            }

            if (updated) {
              await this.#dbAssets.put(assetKey, updatedAsset)
            }
          } catch (_error) {
            //
          }
        }
        this.#log.info('[agent:%s] END storing metadata', this.id)
      },
      error: (e) => this.#log.error(e, '[agent:%s] on metadata store', this.id),
    } as Observer<{ asset: AssetMetadata; chainId: NetworkURN }>
  }

  #putChainProps(chainId: NetworkURN) {
    this.#ingress
      .getNetworkInfo(chainId)
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

  #mapOverrides(): Observable<{
    asset: AssetMetadata
    chainId: NetworkURN
  }> {
    return from(assetOverrides).pipe(
      map((a) => ({
        asset: {
          ...a,
          updated: Date.now(),
        },
        chainId: a.chainId,
      })),
    )
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
                this.#ingress.getStorage(chainId, key).pipe(
                  mapEntry(key, this.#ingress),
                  map((x) => asSerializable<AssetMetadata>(x)),
                ),
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
    return (await this.#db.get('scheduled')) === undefined
  }
}

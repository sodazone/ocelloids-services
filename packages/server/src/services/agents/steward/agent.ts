import { z } from 'zod'

import { EMPTY, expand, firstValueFrom, mergeAll, mergeMap, reduce, switchMap } from 'rxjs'

import { IngressConsumer, NetworkInfo } from '@/services/ingress/index.js'
import { Scheduled, Scheduler } from '@/services/persistence/level/scheduler.js'
import { LevelDB, Logger, NetworkURN } from '@/services/types.js'

import { ValidationError } from '@/errors.js'
import { HexString } from '@/lib.js'
import { getRelayId } from '@/services/config.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryPagination,
  QueryParams,
  QueryResult,
  Queryable,
  getAgentCapabilities,
} from '../types.js'

import { ParsedAsset, parseAssetFromJson } from './location.js'
import { mappers } from './mappers.js'
import {
  $StewardQueryArgs,
  AssetMapper,
  AssetMapping,
  AssetMetadata,
  StewardQueryArgs,
  XcmVersions,
} from './types.js'
import { paginatedResults } from './util.js'

const ASSET_METADATA_SYNC_TASK = 'task:steward:assets-metadata-sync'
const AGENT_LEVEL_PREFIX = 'agent:steward'
const ASSETS_LEVEL_PREFIX = 'agent:steward:assets'
const CHAIN_INFO_LEVEL_PREFIX = 'agent:steward:chains'

function normalize(assetId: string) {
  return assetId.toLowerCase().replaceAll('"', '')
}

function assetMetadataKey(chainId: NetworkURN, assetId: string) {
  return `${chainId}:${normalize(assetId)}`
}

const STORAGE_PAGE_LEN = 100

const START_DELAY = 30_000 // 5m
const SCHED_RATE = 43_200_000 // 12h

const OMEGA_250 = Array(250).fill('\uFFFF').join('')
const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

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
  readonly #dbAssets: LevelDB
  readonly #dbChains: LevelDB

  constructor(ctx: AgentRuntimeContext) {
    this.#sched = ctx.scheduler
    this.#ingress = ctx.ingress
    this.#db = ctx.db.sublevel<string, any>(AGENT_LEVEL_PREFIX, {})
    this.#dbAssets = ctx.db.sublevel<string, AssetMetadata>(ASSETS_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#dbChains = ctx.db.sublevel<string, NetworkInfo>(CHAIN_INFO_LEVEL_PREFIX, {
      valueEncoding: 'json',
    })
    this.#log = ctx.log

    this.#sched.on(ASSET_METADATA_SYNC_TASK, this.#onScheduledTask.bind(this))
  }

  get querySchema(): z.ZodSchema {
    return $StewardQueryArgs
  }

  async query(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    const { args, pagination } = params
    $StewardQueryArgs.parse(args)

    // TODO extract queries map
    if (args.op === 'assets') {
      return await this.#queryAssetMetadata(args.criteria)
    } else if (args.op === 'assets.list') {
      return await this.#queryAssetMetadataList(args.criteria, pagination)
    } else if (args.op === 'assets.by_location') {
      return await this.#queryAssetMetadataByLocation(args.criteria)
    } else if (args.op === 'chains') {
      return await this.#queryChains(args.criteria)
    } else if (args.op === 'chains.list') {
      return await this.#queryChainList(pagination)
    }

    throw new ValidationError('Unknown query type')
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
    if (await this.#isNotScheduled()) {
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

  // TODO: temporary support for fetching asset metadata from multilocation
  // will be refactored, probably as part of the XCM Humanizer agent
  async #queryAssetMetadataByLocation(
    criteria: { network: string; locations: string[]; version?: XcmVersions }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const keys: string[] = []
    for (const { network: referenceNetwork, locations, version } of criteria) {
      const relayRegistry = await this.#getRegistry(getRelayId(referenceNetwork as NetworkURN))

      for (const loc of locations) {
        let parsed: ParsedAsset | null = null
        try {
          parsed = parseAssetFromJson(referenceNetwork as NetworkURN, loc, relayRegistry, version)

          if (parsed) {
            const { network, assetId } = parsed
            if (typeof assetId === 'string') {
              keys.push(assetMetadataKey(network, assetId))
            } else {
              const registry = await this.#getRegistry(network)
              for (const mapping of mappers[network].mappings) {
                const keyValue = assetId.data.slice(0, assetId.length)
                const id = mapping.resolveKey
                  ? mapping.resolveKey(registry, keyValue)
                  : registry.createType(mapping.assetIdType, keyValue).toString()
                keys.push(assetMetadataKey(network, id))
              }
            }
          } else {
            keys.push(loc)
          }
        } catch (e) {
          this.#log.error(e, '[agent:%s] error converting multiLocation to assetId', this.id)
          keys.push(loc)
        }
      }
    }

    return {
      items: await this.#dbAssets.getMany<string, AssetMetadata>(keys, {
        /** */
      }),
    }
  }

  async #getRegistry(network: NetworkURN) {
    return firstValueFrom(this.#ingress.getRegistry(network))
  }

  async #queryChainList(pagination?: QueryPagination): Promise<QueryResult<NetworkInfo>> {
    const iterator = this.#dbChains.iterator<string, NetworkInfo>({
      gte: pagination?.cursor,
      lte: OMEGA_250,
      limit: Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX),
    })
    return await paginatedResults<string, NetworkInfo>(iterator)
  }

  async #queryChains(criteria: {
    networks: string[]
  }): Promise<QueryResult<NetworkInfo>> {
    return {
      items: await this.#dbChains.getMany<string, NetworkInfo>(criteria.networks, {
        /** */
      }),
    }
  }

  async #queryAssetMetadataList(
    { network }: { network: string },
    pagination?: QueryPagination,
  ): Promise<QueryResult<AssetMetadata>> {
    const cursor = pagination
      ? pagination.cursor === undefined || pagination.cursor === ''
        ? network
        : pagination.cursor
      : network
    const iterator = this.#dbAssets.iterator<string, AssetMetadata>({
      gte: cursor,
      lte: network + ':' + OMEGA_250,
      limit: Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX),
    })
    return await paginatedResults<string, AssetMetadata>(iterator)
  }

  async #queryAssetMetadata(
    criteria: {
      network: string
      assets: string[]
    }[],
  ): Promise<QueryResult<AssetMetadata>> {
    const keys = criteria.flatMap((s) => s.assets.map((a) => assetMetadataKey(s.network as NetworkURN, a)))
    return {
      items: await this.#dbAssets.getMany<string, AssetMetadata>(keys, {
        /** */
      }),
    }
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

    for (const chainId of chainIds) {
      const mapper = mappers[chainId]
      if (mapper) {
        this.#log.info('[agent:%s] GET chain properties (chainId=%s)', this.id, chainId)
        this.#putChainProps(chainId, mapper)

        for (const mapping of mapper.mappings) {
          this.#log.info(
            '[agent:%s] START synchronizing asset metadata (chainId=%s, key=%s)',
            this.id,
            chainId,
            mapping.keyPrefix,
          )
          this.#map(chainId, mapping)
        }
      }
    }
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
          const id = i === 0 ? 'native' : 'native:' + (mapper.nativeKeyBySymbol ? symbol : i)
          const asset: AssetMetadata = {
            id,
            // id native(aaee) index(u8)
            xid: `0xaaee${i.toString(16).padStart(2, '0')}`,
            updated: Date.now(),
            symbol,
            decimals: chainInfo.chainDecimals[i],
            chainId,
            existentialDeposit: chainInfo.existentialDeposit,
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

  #map(chainId: NetworkURN, mapping: AssetMapping) {
    const { keyPrefix, assetIdType, mapEntry } = mapping
    this.#ingress
      .getRegistry(chainId)
      .pipe(
        switchMap((registry) => {
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
                  this.#ingress
                    .getStorage(chainId, key)
                    .pipe(mapEntry(registry, key.substring(keyPrefix.length), assetIdType, this.#ingress)),
                )
              }),
              mergeAll(),
            )
        }),
      )
      .subscribe({
        next: (asset) => {
          const assetKey = assetMetadataKey(chainId, asset.id)
          this.#dbAssets.put(assetKey, asset).catch((e) => {
            this.#log.error(
              e,
              '[agent:%s] on metadata write (chainId=%s, assetId=%s, key=%s)',
              this.id,
              chainId,
              asset.id,
              keyPrefix,
            )
          })
        },
        complete: () => {
          this.#log.info(
            '[agent:%s] END synchronizing asset metadata (chainId=%s, key=%s)',
            this.id,
            chainId,
            keyPrefix,
          )
        },
        error: (e) =>
          this.#log.error(e, '[agent:%s] on metadata sync (chainId=%s, key=%s)', this.id, chainId, keyPrefix),
      })
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

import { z } from 'zod'

import { EMPTY, expand, firstValueFrom, mergeAll, mergeMap, reduce, switchMap } from 'rxjs'

import type { StagingXcmV3MultiLocation } from '@polkadot/types/lookup'

import { IngressConsumer } from '../../ingress/index.js'
import { Scheduled, Scheduler } from '../../persistence/scheduler.js'
import { DB, Logger, NetworkURN } from '../../types.js'

import { getRelayId } from 'services/config.js'
import { ValidationError } from '../../../errors.js'
import { HexString } from '../../../lib.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  getAgentCapabilities,
} from '../types.js'
import { parseMultiLocation } from './location.js'
import { mappers } from './mappers.js'
import { $StewardQueryArgs, AssetMapping, AssetMetadata, StewardQueryArgs } from './types.js'

const ASSET_METADATA_SYNC_TASK = 'task:steward:assets-metadata-sync'
const LEVEL_PREFIX = 'agent:steward:assets:'

function normalize(assetId: string) {
  return assetId.toLowerCase().replaceAll('"', '')
}

function assetMetadataKey(chainId: NetworkURN, assetId: string) {
  return `${chainId}:${normalize(assetId)}`
}

const STORAGE_PAGE_LEN = 100

const OMEGA_250 = Array(250).fill('\uFFFF').join('')
const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

const START_DELAY = 30_000 // 5m
const SCHED_RATE = 43_200_000 // 12h

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable {
  readonly #sched: Scheduler
  readonly #ingress: IngressConsumer
  readonly #db: DB
  readonly #log: Logger

  constructor(ctx: AgentRuntimeContext) {
    this.#sched = ctx.scheduler
    this.#ingress = ctx.ingress
    this.#db = ctx.db.sublevel<string, AssetMetadata>(LEVEL_PREFIX, {
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

    if (args.op === 'assets.metadata') {
      const keys = args.criteria.flatMap((s) =>
        s.assets.map((a) => assetMetadataKey(s.network as NetworkURN, a)),
      )
      return {
        items: (
          await this.#db.getMany<string, AssetMetadata>(keys, {
            /** */
          })
        ).filter((a) => a),
      } as QueryResult
    } else if (args.op === 'assets.metadata.list') {
      const { network } = args.criteria
      const iterator = this.#db.iterator<string, AssetMetadata>({
        gte: pagination?.cursor ?? network,
        lte: network + ':' + OMEGA_250,
        limit: Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX),
      })
      const entries = await iterator.all()

      if (entries.length === 0) {
        return {
          items: [],
        }
      }

      return {
        pageInfo: {
          endCursor: entries[entries.length - 1][0],
          hasNextPage: iterator.count >= iterator.limit,
        },
        items: entries.map(([_, v]) => v),
      }
    } else if (args.op === 'assets.metadata.by_location') {
      const keys: string[] = []
      for (const { network: referenceNetwork, locations } of args.criteria) {
        const relayRegistry = await firstValueFrom(
          this.#ingress.getRegistry(getRelayId(referenceNetwork as NetworkURN)),
        )

        for (const loc of locations) {
          try {
            const multiLocation = relayRegistry.createType('StagingXcmV3MultiLocation', JSON.parse(loc))
            const parsed = parseMultiLocation(referenceNetwork as NetworkURN, multiLocation)
            if (parsed) {
              const { network, assetId } = parsed
              if (typeof assetId === 'string') {
                keys.push(assetMetadataKey(network, assetId))
              } else {
                const registry = await firstValueFrom(this.#ingress.getRegistry(network))
                for (const mapping of mappers[network].mappings) {
                  const id = mapping.mapKey(registry, assetId)
                  keys.push(assetMetadataKey(network, id))
                }
              }
            }
          } catch (e) {
            this.#log.error(e, '[agent:%s] error converting multiLocation to assetId', this.id)
          }
        }
      }
      return {
        items: (
          await this.#db.getMany<string, AssetMetadata>(keys, {
            /** */
          })
        ).filter((a) => a),
      } as QueryResult
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
      setTimeout(() => {
        this.#syncAssetMetadata()
      }, START_DELAY)
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

    for (const chainId of chainIds) {
      const mapper = mappers[chainId]
      if (mapper) {
        this.#log.info('[agent:%s] GET chain properties (chainId=%s)', this.id, chainId)
        this.#putChainProps(chainId)

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

  #putChainProps(chainId: NetworkURN) {
    this.#ingress
      .getChainProperties(chainId)
      .then((props) => {
        if (props.tokenSymbol.isSome) {
          const symbols = props.tokenSymbol.unwrap().toArray()
          const decimals = props.tokenDecimals.unwrap().toArray()

          for (let i = 0; i < symbols.length; i++) {
            const asset: AssetMetadata = {
              id: 'native#' + i,
              updated: Date.now(),
              symbol: symbols[i].toString(),
              decimals: decimals[i].toNumber(),
              chainId,
              raw: {
                native: true,
              },
            }
            this.#db.put(assetMetadataKey(chainId, asset.id), asset).catch((e) => {
              this.#log.error(e, '[agent:%s] while writing chain properties (chainId=%s)', this.id, chainId)
            })
          }
        }
      })
      .catch((e) => {
        this.#log.error(e, '[agent:%s] while getting chain properties (chainId=%s)', this.id, chainId)
      })
  }

  #map(chainId: NetworkURN, mapping: AssetMapping) {
    const { keyPrefix, mapEntry } = mapping
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
                    .pipe(mapEntry(registry, key.substring(keyPrefix.length), this.#ingress)),
                )
              }),
              mergeAll(),
            )
        }),
      )
      .subscribe({
        next: (asset) => {
          const assetKey = assetMetadataKey(chainId, asset.id)
          this.#db.put(assetKey, asset).catch((e) => {
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

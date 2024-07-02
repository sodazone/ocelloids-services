import { z } from 'zod'

import { EMPTY, expand, mergeAll, mergeMap, reduce, switchMap } from 'rxjs'

import { IngressConsumer } from '../../ingress/index.js'
import { Scheduled, Scheduler } from '../../persistence/scheduler.js'
import { DB, Logger, NetworkURN } from '../../types.js'

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
import { mappers } from './mappers.js'
import { $StewardQuery, AssetMapping, AssetMetadata, StewardQuery } from './types.js'

const AssetMetadataSyncTaskType = 'task:steward:assets-metadata-sync'
const LEVEL_PREFIX = 'agent:steward:assets:'

function assetMetadataKey(chainId: NetworkURN, assetId: string) {
  return `${chainId}:${assetId}`
}

const STORAGE_PAGE_LEN = 100

const OMEGA_250 = Array(250).fill('\uFFFF').join('')
const API_LIMIT_DEFAULT = 10
const API_LIMIT_MAX = 100

const START_DELAY = 30_000 // 5m
const SCHED_RATE = 43_200_000 // 12h

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

    this.#sched.on(AssetMetadataSyncTaskType, this.#onScheduledTask.bind(this))
  }

  get querySchema(): z.ZodSchema {
    return $StewardQuery
  }

  async query(params: QueryParams<StewardQuery>): Promise<QueryResult> {
    const { args, pagination } = params
    $StewardQuery.parse(args)

    if (args.op === 'find') {
      const keys = args.criteria.flatMap((s) =>
        s.assets.map((a) => assetMetadataKey(s.network as NetworkURN, a)),
      )
      return {
        results: [
          await this.#db.getMany<string, AssetMetadata>(keys, {
            /** */
          }),
        ],
      } as QueryResult
    } else if (args.op === 'list') {
      const { network } = args.criteria
      const iterator = this.#db.iterator<string, AssetMetadata>({
        gte: pagination?.cursor ?? network,
        lte: network + ':' + OMEGA_250,
        limit: Math.min(pagination?.limit ?? API_LIMIT_DEFAULT, API_LIMIT_MAX),
      })
      const entries = await iterator.all()

      if (entries.length === 0) {
        return {
          results: [],
        }
      }

      return {
        pageInfo: {
          endCursor: entries[entries.length - 1][0],
          hasNextPage: iterator.count >= iterator.limit,
        },
        results: entries.map(([_, v]) => v),
      }
    }

    throw new ValidationError('Unknown query type')
  }

  get id(): string {
    return 'steward'
  }

  get metadata(): AgentMetadata {
    return {
      name: 'Data Steward',
      description: 'Aggregates assets and currencies metadata.',
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
    const key = timeString + AssetMetadataSyncTaskType
    const task = {
      key,
      type: AssetMetadataSyncTaskType,
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

import { Observable } from 'rxjs'
import { z } from 'zod'

import { $NetworkString } from '@/common/types.js'
import { HexString, QueryParams, QueryResult } from '@/lib.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { StorageCodec, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Scheduler } from '@/services/scheduling/scheduler.js'
import { AnyJson, LevelDB, Logger, NetworkURN, OpenLevelDB } from '@/services/types.js'
import { SubstrateAccountMetadata } from './accounts/types.js'

/**
 * @private
 */
export const $StewardQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('assets'),
    criteria: z.array(
      z.object({
        network: $NetworkString,
        assets: z.array(z.string()).min(1).max(50),
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.list'),
    criteria: z.optional(
      z.object({
        network: $NetworkString,
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.by_location'),
    criteria: z.array(
      z.object({
        xcmLocationAnchor: $NetworkString,
        locations: z.array(z.string()).min(1).max(50),
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.by_hash'),
    criteria: z.object({
      assetHashes: z.array(z.string()).min(1).max(100),
    }),
  }),
  z.object({
    op: z.literal('chains.list'),
  }),
  z.object({
    op: z.literal('chains'),
    criteria: z.object({
      networks: z.array($NetworkString).min(1).max(50),
    }),
  }),
  z.object({
    op: z.literal('chains.prefix'),
    criteria: z.object({
      networks: z.array($NetworkString).min(1).max(50),
    }),
  }),
  z.object({
    op: z.literal('chains.wormhole.by_id'),
    criteria: z.object({
      ids: z.array(z.number()).min(1).max(50),
    }),
  }),
  z.object({
    op: z.literal('assets.wormhole'),
    criteria: z
      .array(
        z.object({
          wormholeId: z.number(),
          assets: z.array(z.string()).min(1).max(50),
        }),
      )
      .min(1)
      .max(10),
  }),
  z.object({
    op: z.literal('accounts'),
    criteria: z.object({
      accounts: z.array(z.string().min(3).max(100)).min(1).max(100),
    }),
  }),
  z.object({
    op: z.literal('accounts.list'),
  }),
])

/**
 * Data Steward query arguments.
 *
 * @private
 */
export type StewardQueryArgs = z.infer<typeof $StewardQueryArgs>

/**
 * @public
 */
export type ParsedAsset = {
  network: NetworkURN
  assetId:
    | {
        type: 'string'
        value: string
      }
    | {
        type: 'data'
        value: Uint8Array
      }
    | {
        type: 'contract'
        value: string
      }
  pallet?: number
}

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
type AssetStorageKeys = 'assets' | 'metadata' | 'locations'
export type StorageCodecs<T = any> = Partial<Record<AssetStorageKeys, StorageCodec<T>>>

export type entryMapper = (
  keyArgs: string,
  ingress: SubstrateIngressConsumer,
) => (source: Observable<HexString>) => Observable<AssetMetadata>

export type AssetMapping = {
  keyPrefix: HexString
  mapEntry: entryMapper
  mapAssetId?: (data: Uint8Array) => any[] | undefined
}

export type AssetMapper = (context: SubstrateApiContext) => AssetMapping[]

/**
 * @public
 */
export type AssetId = string | object | number
/**
 * @public
 */
export type AssetIds = {
  id: AssetId
  xid: HexString
  chainId: NetworkURN
}

/**
 * The asset metadata.
 *
 * @public
 */
export type AssetMetadata = AssetIds & {
  name?: string
  symbol?: string
  decimals?: number
  existentialDeposit?: string
  isSufficient?: boolean
  multiLocation?: Record<string, any> | AnyJson
  sourceId?: AssetIds
  externalIds: AssetIds[]
  updated: number
  raw: Record<string, any>
}

/**
 * Return type for assets that cannot be resolved.
 *
 * @public
 */
export type Empty = {
  isNotResolved: boolean
  query: Record<string, any>
}

/**
 * Mapping of Wormhole chain id to network URN.
 *
 * @public
 */
export type WormholeNetwork = { wormholeId: number; urn: NetworkURN }

export function isAssetMetadata(obj: unknown): obj is AssetMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'xid' in obj &&
    'chainId' in obj &&
    typeof (obj as any).id !== 'undefined' &&
    typeof (obj as any).xid !== 'undefined' &&
    typeof (obj as any).chainId !== 'undefined'
  )
}

export function isAccountMetadata(obj: unknown): obj is SubstrateAccountMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'publicKey' in obj &&
    typeof (obj as any).publicKey !== 'undefined'
  )
}

export type StewardManagerContext = {
  log: Logger
  db: LevelDB
  openLevelDB: OpenLevelDB
  scheduler: Scheduler
  ingress: IngressConsumers
  config?: Record<string, any>
}

const $AccountString = z.string().min(42).max(66)

/**
 * @private
 */
export const $StewardServerSentEventArgs = z.object({
  account: $AccountString.or(z.array($AccountString).min(1).max(5)),
})

/**
 * Data Steward server-sent event arguments.
 *
 * @private
 */
export type StewardServerSentEventArgs = z.infer<typeof $StewardServerSentEventArgs>

/**
 * @internal
 */
export type StewardQueries = (params: QueryParams<StewardQueryArgs>) => Promise<QueryResult>

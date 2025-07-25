import { Observable } from 'rxjs'
import { z } from 'zod'

import { $NetworkString } from '@/common/types.js'
import { HexString } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { StorageCodec, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

const setNetworks = <T extends Record<string, NetworkURN>>(network: T) => network

export const networks = setNetworks({
  polkadot: 'urn:ocn:polkadot:0',
  assetHub: 'urn:ocn:polkadot:1000',
  bridgeHub: 'urn:ocn:polkadot:1002',
  people: 'urn:ocn:polkadot:1004',
  coretime: 'urn:ocn:polkadot:1005',
  acala: 'urn:ocn:polkadot:2000',
  moonbeam: 'urn:ocn:polkadot:2004',
  composable: 'urn:ocn:polkadot:2019',
  astar: 'urn:ocn:polkadot:2006',
  nodle: 'urn:ocn:polkadot:2026',
  bifrost: 'urn:ocn:polkadot:2030',
  centrifuge: 'urn:ocn:polkadot:2031',
  interlay: 'urn:ocn:polkadot:2032',
  hydration: 'urn:ocn:polkadot:2034',
  phala: 'urn:ocn:polkadot:2035',
  manta: 'urn:ocn:polkadot:2104',
  pendulum: 'urn:ocn:polkadot:2094',
  polimec: 'urn:ocn:polkadot:3344',
  mythos: 'urn:ocn:polkadot:3369',
  hyperbridge: 'urn:ocn:polkadot:3367',
  kusama: 'urn:ocn:kusama:0',
  kusamaAssetHub: 'urn:ocn:kusama:1000',
  kusamaBridgeHub: 'urn:ocn:kusama:1002',
  kusamaCoretime: 'urn:ocn:kusama:1005',
  paseo: 'urn:ocn:paseo:0',
  paseoAssetHub: 'urn:ocn:paseo:1000',
})

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
    op: z.literal('chains.list'),
  }),
  z.object({
    op: z.literal('chains'),
    criteria: z.object({
      networks: z.array($NetworkString).min(1).max(50),
    }),
  }),
])

/**
 * Data Steward query arguments.
 *
 * @public
 */
export type StewardQueryArgs = z.infer<typeof $StewardQueryArgs>

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

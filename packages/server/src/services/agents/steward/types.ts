import { z } from 'zod'

import { Registry } from '@polkadot/types-codec/types'

import { Observable } from 'rxjs'

import { HexString } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

const setNetworks = <T extends Record<string, NetworkURN>>(network: T) => network

export const networks = setNetworks({
  polkadot: 'urn:ocn:polkadot:0',
  assetHub: 'urn:ocn:polkadot:1000',
  bridgeHub: 'urn:ocn:polkadot:1002',
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
  mythos: 'urn:ocn:polkadot:3369',
  kusama: 'urn:ocn::kusama:0',
  kusamaAssetHub: 'urn:ocn:kusama:1000',
  kusamaBridgeHub: 'urn:ocn:kusama:1002',
  kusamaCoretime: 'urn:ocn:kusama:1005',
})

export const $NetworkString = z.string().regex(/urn:ocn:[a-z:0-9]+/, 'The network ID must be a valid URN')
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

export type AssetIdData = {
  data: Uint8Array
  length: number
}

export type ParsedAsset = {
  network: NetworkURN
  assetId:
    | {
        type: 'string'
        value: string
      }
    | {
        type: 'data'
        value: AssetIdData[]
      }
  pallet?: number
}

export type entryMapper = (
  registry: Registry,
  keyArgs: string,
  assetIdType: string,
  ingress: IngressConsumer,
) => (source: Observable<Uint8Array>) => Observable<AssetMetadata>

export type AssetMapping = {
  keyPrefix: HexString
  palletInstance: number
  assetIdType: string
  mapEntry: entryMapper
  resolveAssetId?: (registry: Registry, assetIdData: AssetIdData[]) => string
}

export type AssetMapper = {
  nativeKeyBySymbol?: boolean
  mappings: AssetMapping[]
}

export type AssetId = {
  id: string
  xid: HexString
  chainId: NetworkURN
}

/**
 * The asset metadata.
 *
 * @public
 */
export type AssetMetadata = AssetId & {
  name?: string
  symbol?: string
  decimals?: number
  existentialDeposit?: string
  isSufficient?: boolean
  multiLocation?: Record<string, any> | AnyJson
  externalIds: AssetId[]
  updated: number
  raw: Record<string, any>
}

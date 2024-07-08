import { z } from 'zod'

import type { U8aFixed, u8 } from '@polkadot/types-codec'
import { Registry } from '@polkadot/types-codec/types'

import { Observable } from 'rxjs'

import { HexString } from '../../../lib.js'
import { IngressConsumer } from '../../ingress/index.js'
import { AnyJson, NetworkURN } from '../../types.js'

const setNetworks = <T extends Record<string, NetworkURN>>(network: T) => network

export const networks = setNetworks({
  polkadot: 'urn:ocn:polkadot:0',
  bifrost: 'urn:ocn:polkadot:2030',
  assethub: 'urn:ocn:polkadot:1000',
  hydration: 'urn:ocn:polkadot:2034',
  moonbeam: 'urn:ocn:polkadot:2004',
  manta: 'urn:ocn:polkadot:2104',
})

export const $NetworkString = z.string().regex(/urn:ocn:[a-z:0-9]+/, 'The network ID must be a valid URN')
export const $StewardQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('assets.metadata'),
    criteria: z.array(
      z.object({
        network: $NetworkString,
        assets: z.array(z.string()).min(1).max(50),
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.metadata.list'),
    criteria: z.object({
      network: $NetworkString,
    }),
  }),
  z.object({
    op: z.literal('assets.metadata.by_location'),
    criteria: z.array(
      z.object({
        network: $NetworkString,
        locations: z.array(z.string()).min(1).max(50),
        version: z.optional(z.enum(['v3', 'v4'])),
      }),
    ),
  }),
])

/**
 * Data Steward query arguments.
 *
 * @public
 */
export type StewardQueryArgs = z.infer<typeof $StewardQueryArgs>

export type entryMapper = (
  registry: Registry,
  keyArgs: string,
  ingress: IngressConsumer,
) => (source: Observable<Uint8Array>) => Observable<NonNullable<AssetMetadata>>

export type GeneralKey = {
  data: U8aFixed
  length: u8
}

type keyMapper = (registry: Registry, key: GeneralKey) => string

export type AssetMapping = {
  keyPrefix: HexString
  mapEntry: entryMapper
  palletInstance: number
  mapKey: keyMapper
}

export type AssetMapper = {
  mappings: AssetMapping[]
}

/**
 * The asset metadata.
 *
 * @public
 */
export type AssetMetadata = {
  id: string
  chainId: NetworkURN
  name?: string
  symbol?: string
  decimals?: number
  multiLocation?: Record<string, any> | AnyJson
  updated: number
  raw: Record<string, any>
} | null

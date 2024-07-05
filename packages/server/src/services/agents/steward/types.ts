import { z } from 'zod'

import type { U8aFixed, u8 } from '@polkadot/types-codec'
import { Registry } from '@polkadot/types-codec/types'

import { Observable } from 'rxjs'

import { HexString } from '../../../lib.js'
import { IngressConsumer } from '../../ingress/index.js'
import { AnyJson, NetworkURN } from '../../types.js'

export const networks: Record<string, string> = {
  bifrost: 'urn:ocn:polkadot:2030',
  assethub: 'urn:ocn:polkadot:1000',
  hydration: 'urn:ocn:polkadot:2034',
  moonbeam: 'urn:ocn:polkadot:2004',
  manta: 'urn:ocn:polkadot:2104',
}

const networkURNs = Object.values(networks)

export const $StewardQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('assets.metadata'),
    criteria: z.array(
      z.object({
        network: z.enum([networkURNs[0], ...networkURNs.slice(1)]),
        assets: z.array(z.string()).min(1).max(50),
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.metadata.list'),
    criteria: z.object({
      network: z.enum([networkURNs[0], ...networkURNs.slice(1)]),
    }),
  }),
  z.object({
    op: z.literal('assets.metadata.by_location'),
    criteria: z.array(
      z.object({
        network: z.enum([networkURNs[0], ...networkURNs.slice(1)]),
        locations: z.array(z.string()).min(1).max(50),
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
) => (source: Observable<Uint8Array>) => Observable<AssetMetadata>

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
}

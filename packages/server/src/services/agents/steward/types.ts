import { z } from 'zod'

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

export const $StewardQuery = z.discriminatedUnion('op', [
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
])

export type StewardQuery = z.infer<typeof $StewardQuery>

export type entryMapper = (
  registry: Registry,
  keyArgs: string,
  ingress: IngressConsumer,
) => (source: Observable<Uint8Array>) => Observable<AssetMetadata>

export type AssetMapping = {
  keyPrefix: HexString
  mapEntry: entryMapper
}

export type AssetMapper = {
  mappings: AssetMapping[]
}

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

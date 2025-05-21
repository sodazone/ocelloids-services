import { Observable } from 'rxjs'
import { z } from 'zod'

import { $NetworkString } from '@/common/types.js'
import { HexString } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { StorageCodec, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

export const $AssetString = z.string().regex(
  /^urn:ocn:[a-z0-9]+:[a-z0-9]+\|asset:[0-9]+$/,
  'The asset string must follow the format urn:ocn:<network>:<id>|asset:<assetId>'
)

export const $PriceWatcherQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('price'),
    criteria: z.array(
      z.object({
        asset: $AssetString,
      }),
    ),
  }),
  z.object({
    op: z.literal('assets.list'),
  }),
])

/**
 * Data Steward query arguments.
 *
 * @public
 */
export type PriceWatcherQueryArgs = z.infer<typeof $PriceWatcherQueryArgs>

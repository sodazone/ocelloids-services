import { Observable } from 'rxjs'

import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import type { Bytes, Vec } from '@polkadot/types'
import type {
  PolkadotCorePrimitivesInboundDownwardMessage,
  PolkadotCorePrimitivesOutboundHrmpMessage,
} from '@polkadot/types/lookup'

export type GetOutboundHrmpMessages = (
  hash: HexString,
) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Vec<Bytes>>

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN,
) => Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>

export type GetStorageAt = (hash: HexString, key: HexString) => Observable<Uint8Array>

import { Observable } from 'rxjs'

import type { Bytes, Vec } from '@polkadot/types'
import type {
  PolkadotCorePrimitivesInboundDownwardMessage,
  PolkadotCorePrimitivesOutboundHrmpMessage,
} from '@polkadot/types/lookup'
import { HexString } from '../../services/monitoring/types.js'
import { NetworkURN } from '../../services/types.js'

export type GetOutboundHrmpMessages = (hash: HexString) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Vec<Bytes>>

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN
) => Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>

export type GetStorageAt = (hash: HexString, key: HexString) => Observable<Uint8Array>

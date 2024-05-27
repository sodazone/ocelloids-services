import { Observable } from 'rxjs'

import type { Bytes, Vec } from '@polkadot/types'
import type {
  PolkadotCorePrimitivesInboundDownwardMessage,
  PolkadotCorePrimitivesOutboundHrmpMessage,
} from '@polkadot/types/lookup'
import { NetworkURN } from '../types.js'
import { HexString } from './types.js'

export type GetOutboundHrmpMessages = (hash: HexString) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Vec<Bytes>>

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN
) => Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>

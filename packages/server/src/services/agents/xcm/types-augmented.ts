import { Observable } from 'rxjs'

import { Binary } from 'polkadot-api'

import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export type GetOutboundHrmpMessages = (hash: HexString) => Observable<
  {
    recipient: number
    data: Binary
  }[]
>

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Binary[]>

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN,
) => Observable<{ sentAt: number; msg: Binary }[]>

export type GetStorageAt = (hash: HexString, key: HexString) => Observable<HexString>

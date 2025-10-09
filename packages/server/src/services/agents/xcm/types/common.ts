import { Binary } from 'polkadot-api'
import { Observable } from 'rxjs'
import { HexString, NetworkURN } from '@/lib.js'

export type MessageHashData = { hash: HexString; data: HexString; topicId?: HexString }

/**
 * XCM storage prefixes.
 */
export const prefixes = {
  matching: {
    outbound: 'xcm:ma:out',
    inbound: 'xcm:ma:in',
    relay: 'xcm:ma:relay',
    hop: 'xcm:ma:hop',
    bridge: 'xcm:ma:bridge',
    bridgeAccepted: 'xcm:ma:bridgeAccepted',
    bridgeDelivered: 'xcm:ma:bridgeDelivered',
    bridgeIn: 'xcm:ma:bridgeIn',
    messageData: 'xcm:ma:messageData',
  },
}

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

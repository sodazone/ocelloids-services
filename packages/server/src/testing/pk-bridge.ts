import { HexString, NetworkURN } from '@/lib.js'
import { Binary } from 'polkadot-api'
import { from } from 'rxjs'
import { testBlocksFrom } from './blocks.js'

const bridgeOutboundMessageData =
  '0xdd010502090200a10f051c2509030b0100a10f010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46'

export const pkBridgeAccepted = {
  origin: 'urn:ocn:kusama:1002' as NetworkURN,
  blocks: from(testBlocksFrom('kbridgehub/6652869.cbor')),
  getPkBridge: () =>
    from([
      {
        key: '0x2187c09768bea89f950237053705096c000000011806000000000000' as HexString,
        value: Binary.fromHex(bridgeOutboundMessageData),
      },
    ]),
}

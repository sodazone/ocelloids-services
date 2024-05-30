import { Registry } from '@polkadot/types-codec/types'
import { u8aConcat, u8aToU8a } from '@polkadot/util'
import { xxhashAsU8a } from '@polkadot/util-crypto'
import { HexString } from '../../subscriptions/types.js'

// Storage Keys Constants
export const parachainSystemUpwardMessages = '0x45323df7cc47150b3930e2666b0aa313549294c71991aee810463ccf34a0f1d1'
export const parachainSystemHrmpOutboundMessages = '0x45323df7cc47150b3930e2666b0aa3134ec0959dca9d4616632a822d7523ba63'
const dmpDownwardMessageQueuesPartial = '0x63f78c98723ddc9073523ef3beefda0ca95dac46c07a40d91506e7637ec4ba57'

const twox64concat = (data: string | Buffer | Uint8Array) => u8aConcat(xxhashAsU8a(data, 64), u8aToU8a(data))

// TODO resolve storage hasher (?)
// assume twox64concat for the moment
export function dmpDownwardMessageQueuesKey(registry: Registry, paraId: string): HexString {
  return (dmpDownwardMessageQueuesPartial +
    Buffer.from(twox64concat(registry.createType('u32', paraId).toU8a())).toString('hex')) as HexString
}

export const bridgeStorageKeys = {
  kusama: {
    messagesOutboundPartial: '0xc97517321a38a23d9c0aa5983686a3558a395e6242c6813b196ca31ed0547ea7',
  },
  polkadot: {
    messagesOutboundPartial: '0xa0499b8502d976c920e399c80697ef008a395e6242c6813b196ca31ed0547ea7',
  },
  rococo: {
    messagesOutboundPartial: '0x6c94932d373e5f918cd765b7b8f06f118a395e6242c6813b196ca31ed0547ea7',
  },
  westend: {
    messagesOutboundPartial: '0x2b46c0ae62c8114b3eda55630f11ff3a8a395e6242c6813b196ca31ed0547ea7',
  },
} as Record<
  string,
  {
    messagesOutboundPartial: HexString
  }
>

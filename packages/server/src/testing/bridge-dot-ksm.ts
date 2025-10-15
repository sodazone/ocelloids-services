import { XcmSent } from '@/services/agents/xcm/lib.js'
import { XcmInbound } from '@/services/agents/xcm/types/messages.js'

const dotSent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:1002',
      type: 'hrmp',
      partialMessage: undefined,
      relay: 'urn:ocn:local:0',
    },
    {
      from: 'urn:ocn:local:1002',
      to: 'urn:ocn:kusama:1000',
      type: 'vmp',
      partialMessage: undefined,
    },
  ],
  sender: {
    signer: {
      id: '13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN',
      publicKey: '0x7279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b',
    },
    extraSigners: [],
  },
  messageId: '0x0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
    blockNumber: '9153185',
    extrinsicHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
    timestamp: 1751014380000,
    extrinsicPosition: 6,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
    instructions: {},
    messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
    blockNumber: '9153185',
    extrinsicHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
    timestamp: 1751014380000,
    extrinsicPosition: 6,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
    instructions: {},
    messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
  },
  destination: { chainId: 'urn:ocn:kusama:1000' },
}

const kusamaReceive: XcmInbound = {
  chainId: 'urn:ocn:kusama:1000',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {},
    blockNumber: '9845036',
    blockHash: '0xb7564698829732967a7297e45ed7af2b63b1d6f560ea8159f9386378931284f2',
    blockPosition: 6,
    timestamp: 1751014518000,
  },
  extrinsicPosition: undefined,
  blockNumber: '9845036',
  blockHash: '0xb7564698829732967a7297e45ed7af2b63b1d6f560ea8159f9386378931284f2',
  timestamp: 1751014518000,
  messageHash: '0x0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
  messageData: undefined,
  messageId: '0x0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
}

export const dotKsmBridge = {
  sent: dotSent,
  received: kusamaReceive,
}

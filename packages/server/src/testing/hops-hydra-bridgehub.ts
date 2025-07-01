import { XcmSent } from '@/services/agents/xcm/lib.js'
import { XcmInbound } from '@/services/agents/xcm/types/messages.js'

const hydraSent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:2034',
      to: 'urn:ocn:local:1000',
      type: 'hop',
      partialMessage: undefined,
      relay: 'urn:ocn:local:0',
    },
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:1002',
      relay: 'urn:ocn:local:0',
      type: 'hrmp',
      partialMessage:
        '0x040c13000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
    },
  ],
  sender: {
    signer: {
      id: '13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN',
      publicKey: '0x7279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b',
    },
    extraSigners: [],
  },
  messageId: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  forwardId: undefined,
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x006e6514fc8063f1af7b869c0eb7c03a9758da0b433dae0116d0acfad6316b36',
    blockNumber: '8093942',
    extrinsicHash: '0x12342147ed743ba49d0b7777b2ab4524cd5a49656e6c758fd8d67178f3a456df',
    timestamp: 1751015898000,
    extrinsicPosition: 9,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x04180008010000079e144c3204020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90017a08f37e359831035010a13010000079e144c32040016040d0100000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b100101020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90002010907040c13000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f62c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
    instructions: { type: 'V4', value: {} },
    messageHash: '0xdf551e3cb139c3f9f61a482630f06af9a559153fb43b28b54d0e0de73b3451a3',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x006e6514fc8063f1af7b869c0eb7c03a9758da0b433dae0116d0acfad6316b36',
    blockNumber: '8093942',
    extrinsicHash: '0x12342147ed743ba49d0b7777b2ab4524cd5a49656e6c758fd8d67178f3a456df',
    timestamp: 1751015898000,
    extrinsicPosition: 9,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x04180008010000079e144c3204020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90017a08f37e359831035010a13010000079e144c32040016040d0100000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b100101020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90002010907040c13000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f62c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
    instructions: { type: 'V4', value: {} },
    messageHash: '0xdf551e3cb139c3f9f61a482630f06af9a559153fb43b28b54d0e0de73b3451a3',
  },
  destination: { chainId: 'urn:ocn:local:1002' },
}

const assethubHopIn: XcmInbound = {
  chainId: 'urn:ocn:local:1000',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {},
    blockNumber: '9153311',
    blockHash: '0xee6d5fc7d257fd524051c5da84644728b4163832e6202c884ddb16d5ffa91f33',
    blockPosition: 10,
    timestamp: 1751015916000,
  },
  extrinsicPosition: undefined,
  blockNumber: '9153311',
  blockHash: '0xee6d5fc7d257fd524051c5da84644728b4163832e6202c884ddb16d5ffa91f33',
  timestamp: 1751015916000,
  messageHash: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  messageData: undefined,
  messageId: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
}

const assethubHopOut: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:1002',
      type: 'hrmp',
      partialMessage: undefined,
      relay: 'urn:ocn:local:0',
    },
  ],
  sender: undefined,
  messageId: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  forwardId: undefined,
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0xee6d5fc7d257fd524051c5da84644728b4163832e6202c884ddb16d5ffa91f33',
    blockNumber: '9153311',
    extrinsicHash: undefined,
    timestamp: 1751015916000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03140004000100000786b7de790313000100000786b7de79030016040d010204010100a10f2607040014000400000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90017a08f37e359831035010a1300000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f62c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
    instructions: { type: 'V3', value: {} },
    messageHash: '0xb387067f8cdb9b5f5102fd9ac12960d8b08a33dde145ffbb51e4460247d8bccd',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0xee6d5fc7d257fd524051c5da84644728b4163832e6202c884ddb16d5ffa91f33',
    blockNumber: '9153311',
    extrinsicHash: undefined,
    timestamp: 1751015916000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03140004000100000786b7de790313000100000786b7de79030016040d010204010100a10f2607040014000400000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90017a08f37e359831035010a1300000103007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90004000d01020400010300601d579ecd0464a1a090ceef81a703465a1679cd2c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f62c7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
    instructions: { type: 'V3', value: {} },
    messageHash: '0xb387067f8cdb9b5f5102fd9ac12960d8b08a33dde145ffbb51e4460247d8bccd',
  },
  destination: { chainId: 'urn:ocn:local:1002' },
}

const bridgehubIn: XcmInbound = {
  chainId: 'urn:ocn:local:1002',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {},
    blockNumber: '5468649',
    blockHash: '0x998e45878f9a7f1e711bf9fb3340e5b6493d2a9e7e1672777bfc23b468ddabd1',
    blockPosition: 8,
    timestamp: 1751015928000,
  },
  extrinsicPosition: undefined,
  blockNumber: '5468649',
  blockHash: '0x998e45878f9a7f1e711bf9fb3340e5b6493d2a9e7e1672777bfc23b468ddabd1',
  timestamp: 1751015928000,
  messageHash: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  messageData: undefined,
  messageId: '0x7ba0bd809eb613e6137882bb85c46e2c68e3c8eebefc852e823950d499f108f6',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
}

export const hydraAssetHubBridgeHub = {
  sent: hydraSent,
  hopIn: assethubHopIn,
  hopOut: assethubHopOut,
  received: bridgehubIn,
}

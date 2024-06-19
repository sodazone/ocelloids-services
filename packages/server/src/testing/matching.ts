import {
  XcmInbound,
  XcmNotificationType,
  XcmRelayedWithContext,
  XcmSent,
  XcmTerminusContext,
} from '../services/agents/xcm/types.js'

const subscriptionId = 'manamana-1'

const originContext: XcmTerminusContext = {
  chainId: 'urn:ocn:local:1000',
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
  outcome: 'Success',
  error: null,
  instructions: {},
  messageData: '0x0',
  messageHash: '0xCAFE',
}

const outboundMessage: XcmSent = {
  type: XcmNotificationType.Sent,
  messageId: '0xB000',
  legs: [
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:2000',
      relay: 'urn:ocn:local:0',
      type: 'hrmp',
    },
  ],
  destination: {
    chainId: 'urn:ocn:local:2000',
  },
  origin: originContext,
  waypoint: {
    ...originContext,
    legIndex: 0,
  },
  subscriptionId: subscriptionId,
  sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
}

const inboundMessage: XcmInbound = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  chainId: 'urn:ocn:local:2000',
  outcome: 'Success',
  error: null,
  event: {},
  subscriptionId: subscriptionId,
  blockHash: '0xBEEF',
  blockNumber: '2',
}

const relayMessage: XcmRelayedWithContext = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  extrinsicId: '5-1',
  blockHash: '0x828',
  blockNumber: '5',
  recipient: 'urn:ocn:local:2000',
  origin: 'urn:ocn:local:1000',
  outcome: 'Success',
  error: null,
}

export const matchMessages = {
  subscriptionId,
  origin: outboundMessage,
  relay: relayMessage,
  destination: inboundMessage,
}

type MatchHopMessages = {
  subscriptionId: string
  origin: XcmSent
  relay0: XcmRelayedWithContext
  hopin: XcmInbound
  hopout: XcmSent
  relay2: XcmRelayedWithContext
  destination: XcmInbound
}

export const matchHopMessages: MatchHopMessages = {
  subscriptionId,
  origin: {
    ...outboundMessage,
    legs: [
      {
        from: 'urn:ocn:local:1000',
        to: 'urn:ocn:local:3000',
        relay: 'urn:ocn:local:0',
        type: 'hop',
      },
      {
        from: 'urn:ocn:local:3000',
        to: 'urn:ocn:local:2000',
        relay: 'urn:ocn:local:0',
        type: 'hop',
      },
    ],
  },
  relay0: {
    messageHash: '0xCAFE',
    messageId: '0xB000',
    extrinsicId: '5-1',
    blockHash: '0x828',
    blockNumber: '5',
    recipient: 'urn:ocn:local:3000',
    origin: 'urn:ocn:local:1000',
    outcome: 'Success',
    error: null,
  },
  hopin: {
    messageHash: '0xCAFE',
    messageId: '0xB000',
    chainId: 'urn:ocn:local:3000',
    outcome: 'Success',
    error: null,
    event: {},
    subscriptionId: subscriptionId,
    blockHash: '0xBEEF',
    blockNumber: '2',
  },
  hopout: {
    type: XcmNotificationType.Sent,
    messageId: '0xB000',
    legs: [
      {
        from: 'urn:ocn:local:3000',
        to: 'urn:ocn:local:0',
        relay: 'urn:ocn:local:0',
        type: 'hrmp',
      },
    ],
    destination: {
      chainId: 'urn:ocn:local:2000',
    },
    origin: {
      chainId: 'urn:ocn:local:3000',
      event: {},
      blockHash: '0xBEEF',
      blockNumber: '2',
      outcome: 'Success',
      error: null,
      instructions: {},
      messageData: '0x0',
      messageHash: '0xDEAD',
    },
    waypoint: {
      chainId: 'urn:ocn:local:3000',
      event: {},
      blockHash: '0xBEEF',
      blockNumber: '2',
      outcome: 'Success',
      error: null,
      legIndex: 0,
      instructions: {},
      messageData: '0x0',
      messageHash: '0xDEAD',
    },
    subscriptionId: subscriptionId,
    sender: undefined,
  },
  relay2: {
    messageHash: '0xDEAD',
    messageId: '0xB000',
    extrinsicId: '9-1',
    blockHash: '0x222',
    blockNumber: '9',
    recipient: 'urn:ocn:local:2000',
    origin: 'urn:ocn:local:3000',
    outcome: 'Success',
    error: null,
  },
  destination: {
    messageHash: '0xDEAD',
    messageId: '0xB000',
    chainId: 'urn:ocn:local:2000',
    outcome: 'Success',
    error: null,
    event: {},
    subscriptionId: subscriptionId,
    blockHash: '0xEEEE',
    blockNumber: '23',
  },
}

const hopOrigin: XcmSent = {
  type: XcmNotificationType.Sent,
  subscriptionId: 'xxx-1',
  legs: [
    { from: 'urn:ocn:local:0', to: 'urn:ocn:local:2034', type: 'hop' },
    { from: 'urn:ocn:local:2034', to: 'urn:ocn:local:1000', relay: 'urn:ocn:local:0', type: 'hop' },
  ],
  waypoint: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x961d8a9cc5f8bc2d1b092d09e9045e3d85e3c186c90dbec7119ca8b5aecb86f3',
    blockNumber: '19777220',
    extrinsicId: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    legIndex: 0,
    messageData:
      '0x31020310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
    instructions: {},
    messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  },
  origin: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x961d8a9cc5f8bc2d1b092d09e9045e3d85e3c186c90dbec7119ca8b5aecb86f3',
    blockNumber: '19777220',
    extrinsicId: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x31020310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
    instructions: {},
    messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  },
  destination: { chainId: 'urn:ocn:local:1000' },
  sender: undefined,
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
}

const hopIB: XcmInbound = {
  subscriptionId: 'xxx-1',
  chainId: 'urn:ocn:local:2034',
  event: {},
  messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
  outcome: 'Success',
  error: null,
  blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
  blockNumber: '4624161',
  extrinsicId: '4624161-1',
  assetsTrapped: undefined,
}

const hopOB: XcmSent = {
  type: XcmNotificationType.Sent,
  subscriptionId: 'xxx-1',
  legs: [{ from: 'urn:ocn:local:2034', to: 'urn:ocn:local:1000', relay: 'urn:ocn:local:0', type: 'hrmp' }],
  waypoint: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
    blockNumber: '4624161',
    extrinsicId: '4624161-1',
    event: {},
    outcome: 'Success',
    error: null,
    legIndex: 0,
    messageData:
      '0x03100004000002043205011f0007f1d9052a010a13000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
    instructions: {},
    messageHash: '0x03f0f87c9f89de3b78e730e0c6af44941b3ada5446b46ff59460faa667a0c85d',
  },
  origin: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
    blockNumber: '4624161',
    extrinsicId: '4624161-1',
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03100004000002043205011f0007f1d9052a010a13000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
    instructions: {},
    messageHash: '0x03f0f87c9f89de3b78e730e0c6af44941b3ada5446b46ff59460faa667a0c85d',
  },
  destination: { chainId: 'urn:ocn:local:1000' },
  sender: {
    signer: { id: '7HbZHW7QDL6nqhVE4YRVnmkmia1XTYfntFuGm4WyAsTijUu7', publicKey: '0x01' },
    extraSigners: [],
  },
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
}

type RealHopMessages = {
  subscriptionId: string
  origin: XcmSent
  hopin: XcmInbound
  hopout: XcmSent
}

export const realHopMessages: RealHopMessages = {
  subscriptionId: 'xxx-1',
  origin: hopOrigin,
  hopin: hopIB,
  hopout: hopOB,
}

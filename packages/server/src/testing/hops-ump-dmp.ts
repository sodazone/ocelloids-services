import { XcmSent } from '@/services/agents/xcm/lib.js'
import { XcmInbound } from '@/services/agents/xcm/types/messages.js'

const sent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:2034',
      to: 'urn:ocn:local:0',
      type: 'hop',
      partialMessage: undefined,
    },
    {
      from: 'urn:ocn:local:0',
      to: 'urn:ocn:local:2032',
      type: 'vmp',
      partialMessage:
        '0x04081301000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a',
    },
  ],
  sender: {
    signer: {
      id: '14VJdWHdzgXZKaLSqcFcvRYgdhZW4iK8KMuKDZRkT67D2BbK',
      publicKey: '0x9a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a',
    },
    extraSigners: [],
  },
  messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  forwardId: undefined,
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x6484f591031ecf2f1244dff3c444be0068acbd6d517d79ee30fc3123ab26df46',
    blockNumber: '8564507',
    extrinsicHash: '0x620721d1dcb9f51e17ce7fced9a585452cdb497f4291051b4cd81ea141de6c6b',
    specVersion: 324,
    timestamp: 1753882680000,
    extrinsicPosition: 5,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x0414000400000007f873afbc280a1300000007fcb9575e14000e010204000100c11f081301000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a2c404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    instructions: {},
    messageHash: '0x7514be214687a98e7817034e8fa0b2695a3d5dfed300d574fdddc312731da551',
    messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x6484f591031ecf2f1244dff3c444be0068acbd6d517d79ee30fc3123ab26df46',
    blockNumber: '8564507',
    extrinsicHash: '0x620721d1dcb9f51e17ce7fced9a585452cdb497f4291051b4cd81ea141de6c6b',
    specVersion: 324,
    timestamp: 1753882680000,
    extrinsicPosition: 5,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x0414000400000007f873afbc280a1300000007fcb9575e14000e010204000100c11f081301000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a2c404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    instructions: {},
    messageHash: '0x7514be214687a98e7817034e8fa0b2695a3d5dfed300d574fdddc312731da551',
    messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  },
  destination: { chainId: 'urn:ocn:local:2032' },
}

const hopIn: XcmInbound = {
  chainId: 'urn:ocn:local:0',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {},
    blockNumber: '27105430',
    blockHash: '0xeac497f33a66cf729073898efb5de3c4700c19a5b2a3c314b90bad81afd69d17',
    blockPosition: 64,
    specVersion: 1006001,
    timestamp: 1753882698000,
  },
  extrinsicPosition: undefined,
  blockNumber: '27105430',
  blockHash: '0xeac497f33a66cf729073898efb5de3c4700c19a5b2a3c314b90bad81afd69d17',
  specVersion: 1006001,
  timestamp: 1753882698000,
  messageHash: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  messageData: undefined,
  messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
  assetSwaps: undefined,
}

const hopOut: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:0',
      to: 'urn:ocn:local:2032',
      type: 'vmp',
      partialMessage: undefined,
    },
  ],
  sender: undefined,
  messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  forwardId: undefined,
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0xeac497f33a66cf729073898efb5de3c4700c19a5b2a3c314b90bad81afd69d17',
    blockNumber: '27105430',
    extrinsicHash: undefined,
    specVersion: undefined,
    timestamp: 1753882698000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x031401040001000007bcef0ba2280a130001000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a2c404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    instructions: {},
    messageHash: '0xec2bc1953d032d6ac959ff711e0df632251b75a61bec7a6e103f775db2f4a462',
    messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0xeac497f33a66cf729073898efb5de3c4700c19a5b2a3c314b90bad81afd69d17',
    blockNumber: '27105430',
    extrinsicHash: undefined,
    specVersion: undefined,
    timestamp: 1753882698000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x031401040001000007bcef0ba2280a130001000007fcb9575e14000d010204000101009a4aeae262919949aafad880ef2c9560ce3697027ec2435b3353dd126d2ee53a2c404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
    instructions: {},
    messageHash: '0xec2bc1953d032d6ac959ff711e0df632251b75a61bec7a6e103f775db2f4a462',
    messageId: '0x404e53863c9cc30ca3426c3f92a4eb84ba8c6bdd8cb2a0084cfc20d314c15f9d',
  },
  destination: { chainId: 'urn:ocn:local:2032' },
}

const received: XcmInbound = {
  chainId: 'urn:ocn:local:2032',
  event: {
    module: 'DmpQueue',
    name: 'ExecutedDownward',
    value: {},
    blockNumber: '8372782',
    blockHash: '0x2a43b2719921868aac618e7636c24103f4e879a2702802cc48daf44c17ae2e88',
    blockPosition: 10,
    specVersion: 1025005,
    timestamp: 1753882705855,
  },
  extrinsicPosition: undefined,
  blockNumber: '8372782',
  blockHash: '0x2a43b2719921868aac618e7636c24103f4e879a2702802cc48daf44c17ae2e88',
  specVersion: 1025005,
  timestamp: 1753882705855,
  messageHash: '0xec2bc1953d032d6ac959ff711e0df632251b75a61bec7a6e103f775db2f4a462',
  messageData: undefined,
  messageId: '0xec2bc1953d032d6ac959ff711e0df632251b75a61bec7a6e103f775db2f4a462',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: null,
  assetsTrapped: undefined,
  assetSwaps: [],
}

export const hydraPolkadotInterlay = {
  sent,
  hopIn,
  hopOut,
  received,
}

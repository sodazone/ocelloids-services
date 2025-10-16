import { XcmSent } from '@/services/agents/xcm/lib.js'
import { XcmInbound } from '@/services/agents/xcm/types/messages.js'

const sent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:0',
      to: 'urn:ocn:local:2034',
      type: 'hop',
      partialMessage: undefined,
    },
    {
      from: 'urn:ocn:local:2034',
      to: 'urn:ocn:local:1000',
      type: 'hop',
      partialMessage:
        '0x030813000002043205011f00eaa64100000e0101000002043205011f00010100591f081300010300a10f043205011f00b6e13600000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
      relay: 'urn:ocn:local:0',
    },
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:2006',
      type: 'hrmp',
      partialMessage:
        '0x03081300010300a10f043205011f00b6e13600000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
      relay: 'urn:ocn:local:0',
    },
  ],
  sender: {
    signer: {
      id: '1phKfRLnZm8iWTq5ki2xAPf5uwxjBrEe6Bc3Tw2bxPLx3t8',
      publicKey: '0x246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
    },
    extraSigners: [],
  },
  messageId: '0x7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x14420598aaf4cf60b7c2382d8336b6fde76c9066afe3a11993ff843d516ff236',
    blockNumber: '26878097',
    extrinsicHash: '0xe374935231b87070046722667b4e2e8d42489e66739982a8627abc2424bbf9f0',
    timestamp: 1752514128000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x031801040001000003005ed0b20a130001000003005ed0b2000f0101000100000400010300a10f043205011f00f2a641000010010100010300a10f043205011f00010100a10f0813000002043205011f00eaa64100000e0101000002043205011f00010100591f081300010300a10f043205011f00b6e13600000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c',
    instructions: {},
    messageHash: '0x061a3362ddb6134f0b804f5bfffb78cce67070a21ea88d541d68e26e6889239d',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x14420598aaf4cf60b7c2382d8336b6fde76c9066afe3a11993ff843d516ff236',
    blockNumber: '26878097',
    extrinsicHash: '0xe374935231b87070046722667b4e2e8d42489e66739982a8627abc2424bbf9f0',
    timestamp: 1752514128000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x031801040001000003005ed0b20a130001000003005ed0b2000f0101000100000400010300a10f043205011f00f2a641000010010100010300a10f043205011f00010100a10f0813000002043205011f00eaa64100000e0101000002043205011f00010100591f081300010300a10f043205011f00b6e13600000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c',
    instructions: {},
    messageHash: '0x061a3362ddb6134f0b804f5bfffb78cce67070a21ea88d541d68e26e6889239d',
  },
  destination: { chainId: 'urn:ocn:local:2006' },
}

const hopIn2034: XcmInbound = {
  chainId: 'urn:ocn:local:2034',
  event: {},
  extrinsicPosition: undefined,
  blockNumber: '8339191',
  blockHash: '0x8c740043151df2a82881ae5e9c9a11c1df8fed7bdaf9d1fce047e77a4e49c8f8',
  timestamp: 1752514134000,
  messageHash: '0x7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c',
  messageData: undefined,
  messageId: '0x7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: {
    event: {
      eventId: 44,
      blockNumber: '8339191',
      blockHash: '0x8c740043151df2a82881ae5e9c9a11c1df8fed7bdaf9d1fce047e77a4e49c8f8',
      section: 'PolkadotXcm',
      method: 'AssetsTrapped',
    },
    assets: [],
    hash: '0x7136ff59ff7f064d64d6d7b772adbc72063985bf40b97f9cf7c83684325cd35d',
  },
  assetSwaps: [],
}

const hopOut2034: XcmSent = {
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
      to: 'urn:ocn:local:2006',
      type: 'hrmp',
      partialMessage:
        '0x040813010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
      relay: 'urn:ocn:local:0',
    },
  ],
  sender: undefined,
  messageId: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x8c740043151df2a82881ae5e9c9a11c1df8fed7bdaf9d1fce047e77a4e49c8f8',
    blockNumber: '8339191',
    extrinsicHash: undefined,
    timestamp: 1752514134000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x041400040002043205011f00f2a641000a130002043205011f00eaa64100000e01010002043205011f00010100591f0813010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    instructions: {},
    messageHash: '0xe5464e6ca180782f200980a7d8a419e7a73dcbef1342c92a81d55e58212349e3',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0x8c740043151df2a82881ae5e9c9a11c1df8fed7bdaf9d1fce047e77a4e49c8f8',
    blockNumber: '8339191',
    extrinsicHash: undefined,
    timestamp: 1752514134000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x041400040002043205011f00f2a641000a130002043205011f00eaa64100000e01010002043205011f00010100591f0813010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    instructions: {},
    messageHash: '0xe5464e6ca180782f200980a7d8a419e7a73dcbef1342c92a81d55e58212349e3',
  },
  destination: { chainId: 'urn:ocn:local:2006' },
}

const hopIn1000: XcmInbound = {
  chainId: 'urn:ocn:local:1000',
  event: {},
  extrinsicPosition: undefined,
  blockNumber: '9276283',
  blockHash: '0x7a5ce5c4326895c19260014fecc4b6dc704c9525253152fc90ce056b7186f145',
  timestamp: 1752514158000,
  messageHash: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
  messageData: undefined,
  messageId: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
  assetSwaps: [],
}

const hopOut1000: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:2006',
      type: 'hrmp',
      partialMessage: undefined,
      relay: 'urn:ocn:local:0',
    },
  ],
  sender: undefined,
  messageId: '0x3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0x7a5ce5c4326895c19260014fecc4b6dc704c9525253152fc90ce056b7186f145',
    blockNumber: '9276283',
    extrinsicHash: undefined,
    timestamp: 1752514158000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x05140104010300a10f043205011f003ead38000a13010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    instructions: {},
    messageHash: '0xa6a9047ac211d27c2ed28b65e9db76e1dc76266feeabd2b2ee0f46e6bf485648',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:local:1000',
    blockHash: '0x7a5ce5c4326895c19260014fecc4b6dc704c9525253152fc90ce056b7186f145',
    blockNumber: '9276283',
    extrinsicHash: undefined,
    timestamp: 1752514158000,
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x05140104010300a10f043205011f003ead38000a13010300a10f043205011f00b6e13600000d0101010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c3378f662306c8af91d26794551182b55e76504431c89e3584139af0f728b6477',
    instructions: {},
    messageHash: '0xa6a9047ac211d27c2ed28b65e9db76e1dc76266feeabd2b2ee0f46e6bf485648',
  },
  destination: { chainId: 'urn:ocn:local:2006' },
}

const received: XcmInbound = {
  chainId: 'urn:ocn:local:2006',
  event: {},
  extrinsicPosition: undefined,
  blockNumber: '9344923',
  blockHash: '0x4095f33fcec4fed812a6e47cd75b6b52b85e8137426ffc0cf5d381749f21f92b',
  timestamp: 1752514182000,
  messageHash: '0xa6a9047ac211d27c2ed28b65e9db76e1dc76266feeabd2b2ee0f46e6bf485648',
  messageData: undefined,
  messageId: '0xa6a9047ac211d27c2ed28b65e9db76e1dc76266feeabd2b2ee0f46e6bf485648',
  extrinsicHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
  assetSwaps: [],
}

export const twoHopSwap = {
  sent,
  hopIn2034,
  hopOut2034,
  hopIn1000,
  hopOut1000,
  received,
}

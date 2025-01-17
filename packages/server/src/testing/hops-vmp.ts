import { XcmInbound, XcmSent } from '@/services/agents/xcm/types.js'

const bifrostSent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:polkadot:2030',
      to: 'urn:ocn:polkadot:0',
      type: 'hop',
    },
    {
      from: 'urn:ocn:polkadot:0',
      to: 'urn:ocn:polkadot:2034',
      type: 'vmp',
      partialMessage:
        '0x0408130100000b097290d1c109000d0102040001010016842e1c98a7990f532c5b814228dc1040af73f227842a82ab6b9bcdab0cba4e',
    },
  ],
  sender: {
    signer: {
      id: '1WXKWfLcY76BcNVZTMBYZnBp4tTzQNwUAXd6vT2KXBg46Bu',
      publicKey: '0x16842e1c98a7990f532c5b814228dc1040af73f227842a82ab6b9bcdab0cba4e',
    },
    extraSigners: [],
  },
  messageId: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2030',
    blockHash: '0x9afe5190c7d71f41e47545c54033867704e2c386064e8130c4358d96d2a78c68',
    blockNumber: '6352238',
    extrinsicHash: '0x2c3dd105aeb7e56d57e4ba4f4580c7d1c6a96778fe419cf7ddcd106e7b91fdd0',
    timestamp: 1737030894000,
    extrinsicPosition: 2,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      blockNumber: '6352238',
      blockHash: '0x9afe5190c7d71f41e47545c54033867704e2c386064e8130c4358d96d2a78c68',
      blockPosition: 4,
      timestamp: 1737030894000,
      extrinsicPosition: 2,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040000000b12e420a383130a130000000b097290d1c109000e010204000100c91f08130100000b097290d1c109000d0102040001010016842e1c98a7990f532c5b814228dc1040af73f227842a82ab6b9bcdab0cba4e',
    instructions: { type: 'V4', value: [] },
    messageHash: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2030',
    blockHash: '0x9afe5190c7d71f41e47545c54033867704e2c386064e8130c4358d96d2a78c68',
    blockNumber: '6352238',
    extrinsicHash: '0x2c3dd105aeb7e56d57e4ba4f4580c7d1c6a96778fe419cf7ddcd106e7b91fdd0',
    timestamp: 1737030894000,
    extrinsicPosition: 2,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      blockNumber: '6352238',
      blockHash: '0x9afe5190c7d71f41e47545c54033867704e2c386064e8130c4358d96d2a78c68',
      blockPosition: 4,
      timestamp: 1737030894000,
      extrinsicPosition: 2,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040000000b12e420a383130a130000000b097290d1c109000e010204000100c91f08130100000b097290d1c109000d0102040001010016842e1c98a7990f532c5b814228dc1040af73f227842a82ab6b9bcdab0cba4e',
    instructions: { type: 'V4', value: [] },
    messageHash: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
  },
  destination: { chainId: 'urn:ocn:polkadot:2034' },
}

const polkadotHopIn: XcmInbound = {
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
      success: true,
    },
    blockNumber: '24312577',
    blockHash: '0xb68383f99b3d8dabb42d93424961435b8fd892764dd80af05c162b401463db9d',
    blockPosition: 55,
    timestamp: 1737030906001,
  },
  messageHash: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
  messageId: '0x541ccb1a399f06e901d1fa23914874d4ec0efbcd9cced39c687b29f5328e9c5f',
  blockHash: '0xb68383f99b3d8dabb42d93424961435b8fd892764dd80af05c162b401463db9d',
  blockNumber: '24312577',
  timestamp: 1737030906001,
  chainId: 'urn:ocn:polkadot:0',
  outcome: 'Success',
}

const hydraReceive0: XcmInbound = {
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0xa01291c635e6a40c554ca9bf098ea09257b14d91d7e0308837b4fdc36953bd9f',
      success: true,
    },
    blockNumber: '6783592',
    blockHash: '0x96d29a51b91bc85f83b826d1fe2517a093c8c69b2b4aa5b6ccfd581f1eeeed3e',
    blockPosition: 5,
    timestamp: 1737030924000,
  },
  messageHash: '0xa01291c635e6a40c554ca9bf098ea09257b14d91d7e0308837b4fdc36953bd9f',
  messageId: '0xa01291c635e6a40c554ca9bf098ea09257b14d91d7e0308837b4fdc36953bd9f',
  blockHash: '0x96d29a51b91bc85f83b826d1fe2517a093c8c69b2b4aa5b6ccfd581f1eeeed3e',
  blockNumber: '6783592',
  timestamp: 1737030924000,
  chainId: 'urn:ocn:polkadot:2034',
  outcome: 'Success',
}

const hydraReceive1: XcmInbound = {
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0xe1b53a206c2d46536c1fe4768fd3ef25d5258465a1e377ef86b3d20d37328bf1',
      success: true,
    },
    blockNumber: '6783592',
    blockHash: '0x96d29a51b91bc85f83b826d1fe2517a093c8c69b2b4aa5b6ccfd581f1eeeed3e',
    blockPosition: 11,
    timestamp: 1737030924000,
  },
  messageHash: '0xe1b53a206c2d46536c1fe4768fd3ef25d5258465a1e377ef86b3d20d37328bf1',
  messageId: '0xe1b53a206c2d46536c1fe4768fd3ef25d5258465a1e377ef86b3d20d37328bf1',
  blockHash: '0x96d29a51b91bc85f83b826d1fe2517a093c8c69b2b4aa5b6ccfd581f1eeeed3e',
  blockNumber: '6783592',
  timestamp: 1737030924000,
  chainId: 'urn:ocn:polkadot:2034',
  outcome: 'Success',
}

export const bifrostHydraVmp = {
  sent: bifrostSent,
  hopIn: polkadotHopIn,
  received0: hydraReceive0,
  received1: hydraReceive1,
}

import { XcmInbound, XcmRelayedWithContext, XcmSent } from '@/services/agents/xcm/types/index.js'

const hydraSent: XcmSent = {
  originProtocol: 'xcm',
  destinationProtocol: 'xcm',
  legs: [
    {
      from: 'urn:ocn:polkadot:2034',
      to: 'urn:ocn:polkadot:2006',
      type: 'hop',
      relay: 'urn:ocn:polkadot:0',
    },
    {
      from: 'urn:ocn:polkadot:2006',
      to: 'urn:ocn:polkadot:2030',
      type: 'hrmp',
      partialMessage:
        '0x040813010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  sender: {
    signer: {
      id: '7NSzbPmboW99jDFj9MoHDU8R1oNxs4pVDnNzWogcoyE2DhVZ',
      publicKey: '0xd6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    },
    extraSigners: [],
  },
  messageId: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2034',
    blockHash: '0x41b84a4b9121373df323648b5b2ac59e82828eea6b8f5d0ff4fae4d9290ca086',
    blockNumber: '6783730',
    txHash: '0x54dec578372374b8417738861dfe1ea4185be3e3b6a0183d7c8da4ca69a2e1e6',
    timestamp: 1737032856000,
    txPosition: 4,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      blockNumber: '6783730',
      blockHash: '0x41b84a4b9121373df323648b5b2ac59e82828eea6b8f5d0ff4fae4d9290ca086',
      blockPosition: 8,
      timestamp: 1737032856000,
      extrinsicPosition: 4,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040000001b000040b2bac9e0191e020a130000001b00002059dd64f00c0f01000e010204010100b91f0813010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    instructions: { type: 'V4', value: [] },
    messageHash: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2034',
    blockHash: '0x41b84a4b9121373df323648b5b2ac59e82828eea6b8f5d0ff4fae4d9290ca086',
    blockNumber: '6783730',
    txHash: '0x54dec578372374b8417738861dfe1ea4185be3e3b6a0183d7c8da4ca69a2e1e6',
    timestamp: 1737032856000,
    txPosition: 4,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      blockNumber: '6783730',
      blockHash: '0x41b84a4b9121373df323648b5b2ac59e82828eea6b8f5d0ff4fae4d9290ca086',
      blockPosition: 8,
      timestamp: 1737032856000,
      extrinsicPosition: 4,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040000001b000040b2bac9e0191e020a130000001b00002059dd64f00c0f01000e010204010100b91f0813010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    instructions: { type: 'V4', value: [] },
    messageHash: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  },
  destination: { chainId: 'urn:ocn:polkadot:2030' },
}

const astarHopIn: XcmInbound = {
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
      success: true,
    },
    blockNumber: '7898378',
    blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
    blockPosition: 19,
    timestamp: 1737032868000,
  },
  messageHash: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  messageId: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
  blockNumber: '7898378',
  timestamp: 1737032868000,
  chainId: 'urn:ocn:polkadot:2006',
  outcome: 'Success',
}

const astarHopOut: XcmSent = {
  originProtocol: 'xcm',
  destinationProtocol: 'xcm',
  legs: [
    {
      from: 'urn:ocn:polkadot:2006',
      to: 'urn:ocn:polkadot:2030',
      type: 'hrmp',
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  messageId: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2006',
    blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
    blockNumber: '7898378',
    timestamp: 1737032868000,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      blockNumber: '7898378',
      blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
      blockPosition: 16,
      timestamp: 1737032868000,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x04100104010100591f001b063c6c60acd23f191e020a13010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    instructions: { type: 'V4', value: [] },
    messageHash: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2006',
    blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
    blockNumber: '7898378',
    timestamp: 1737032868000,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      blockNumber: '7898378',
      blockHash: '0xcd40316a935346c6f6abc43cb986de4c3ad7ef8eecdbbb1a0eff11973e80cb6c',
      blockPosition: 16,
      timestamp: 1737032868000,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x04100104010100591f001b063c6c60acd23f191e020a13010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
    instructions: { type: 'V4', value: [] },
    messageHash: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  },
  destination: { chainId: 'urn:ocn:polkadot:2030' },
}

const bifrostReceive: XcmInbound = {
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
      success: true,
    },
    blockNumber: '6352399',
    blockHash: '0x538bba53c9f39b260143facdfbf584d6f2a614fd6754ec2adc13b2d95e1f941d',
    blockPosition: 4,
    timestamp: 1737032886000,
  },
  messageHash: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  messageId: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  blockHash: '0x538bba53c9f39b260143facdfbf584d6f2a614fd6754ec2adc13b2d95e1f941d',
  blockNumber: '6352399',
  timestamp: 1737032886000,
  chainId: 'urn:ocn:polkadot:2030',
  outcome: 'Success',
}

const polkadotRelay0: XcmRelayedWithContext = {
  txPosition: 1,
  blockNumber: '24312899',
  blockHash: '0x884851a792d29c200fb87cf7a5f7a9fe6dee11e7caa51293e382d559830908e5',
  timestamp: 1737032862000,
  messageHash: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  messageData:
    '0x041000040000001b000040b2bac9e0191e020a130000001b00002059dd64f00c0f01000e010204010100b91f0813010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
  messageId: '0x728e2394a33023af2a21efa3092b4cbecbf52b21d8ad7790fd29728a2972d81a',
  recipient: 'urn:ocn:polkadot:2006',
  origin: 'urn:ocn:polkadot:2034',
  outcome: 'Success',
}

const polkadotRelay1: XcmRelayedWithContext = {
  txPosition: 1,
  blockNumber: '24312901',
  blockHash: '0x3456e14150f4bdc2ba1161295cea79ec694ef06d2299812f35af04587029ed06',
  timestamp: 1737032874000,
  messageHash: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  messageData:
    '0x04100104010100591f001b063c6c60acd23f191e020a13010100591f001b00002059dd64f00c0f01000d01020400010100d6a5278d06644f0ca64831082203b30484d98d5a34af53f05e41ba6f6a7a8356',
  messageId: '0xf61b67b82c5611de54690f204fc358c048cc3c523600604cdff6224d843e89f9',
  recipient: 'urn:ocn:polkadot:2030',
  origin: 'urn:ocn:polkadot:2006',
  outcome: 'Success',
}

export const hydraAstarBifrost = {
  sent: hydraSent,
  relay0: polkadotRelay0,
  hopIn: astarHopIn,
  hopOut: astarHopOut,
  relay1: polkadotRelay1,
  received: bifrostReceive,
}

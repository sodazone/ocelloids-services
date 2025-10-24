import { Binary } from 'polkadot-api'
import { from } from 'rxjs'
import { NetworkURN } from '@/lib.js'
import { XcmSent } from '@/services/agents/xcm/lib.js'
import {
  XcmBridgeAcceptedWithContext,
  XcmBridgeInboundWithContext,
  XcmInbound,
} from '@/services/agents/xcm/types/messages.js'
import { testBlocksFrom } from './blocks.js'

const bridgeOutboundMessageData =
  '0xdd010502090200a10f051c2509030b0100a10f010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46'

export const pkBridgeAccepted = {
  origin: 'urn:ocn:kusama:1002' as NetworkURN,
  blocks: from(testBlocksFrom('kbridgehub/6652869.cbor')),
  getPkBridge: () => from([Binary.fromHex(bridgeOutboundMessageData)]),
}

export const pkBridgeReceived = {
  chainId: 'urn:ocn:polkadot:1002' as NetworkURN,
  blocks: from(testBlocksFrom('bridgehub/6100146.cbor')),
}

const kusamaAssetHubSent: XcmSent = {
  originProtocol: 'xcm',
  destinationProtocol: 'xcm',
  legs: [
    {
      from: 'urn:ocn:kusama:1000',
      to: 'urn:ocn:kusama:1002',
      type: 'hop',
      partialMessage: undefined,
      relay: 'urn:ocn:kusama:0',
    },
    {
      from: 'urn:ocn:kusama:1002',
      to: 'urn:ocn:polkadot:1002',
      type: 'bridge',
    },
    {
      from: 'urn:ocn:polkadot:1002',
      to: 'urn:ocn:polkadot:1000',
      type: 'hrmp',
      partialMessage: undefined,
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  sender: {
    signer: {
      id: 'FARDQWM9sDQa7g5dvgNnLo8hd7WjRok16hQgyQMdgdncY1W',
      publicKey: '0x7279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b',
    },
    extraSigners: [],
  },
  messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:kusama:1000',
    blockHash: '0x5764bac47e060e0b6148731500ad427dfcc590c33d165a5e201d546c0cde47d1',
    blockNumber: '11058340',
    txHash: '0x953f47bc221c77585f9d7e950b1b1f58b0a5905fd2225827eed17358df4dd452',
    specVersion: 1007001,
    timestamp: 1759217970000,
    txPosition: 6,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {},
      blockNumber: '11058340',
      blockHash: '0x5764bac47e060e0b6148731500ad427dfcc590c33d165a5e201d546c0cde47d1',
      blockPosition: 9,
      specVersion: 1007001,
      timestamp: 1759217970000,
      extrinsic: {},
      extrinsicPosition: 6,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x0514000401000007c25b6587021301000007c25b6587020016040d010204010100a10f26020100a10f14010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c462cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    instructions: {},
    messageHash: '0x400e1e903c04bcee4d4289585ef56a0aa302faa7023889733ebdf0437f3454a3',
    messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:kusama:1000',
    blockHash: '0x5764bac47e060e0b6148731500ad427dfcc590c33d165a5e201d546c0cde47d1',
    blockNumber: '11058340',
    txHash: '0x953f47bc221c77585f9d7e950b1b1f58b0a5905fd2225827eed17358df4dd452',
    specVersion: 1007001,
    timestamp: 1759217970000,
    txPosition: 6,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {},
      blockNumber: '11058340',
      blockHash: '0x5764bac47e060e0b6148731500ad427dfcc590c33d165a5e201d546c0cde47d1',
      blockPosition: 9,
      specVersion: 1007001,
      timestamp: 1759217970000,
      extrinsic: {},
      extrinsicPosition: 6,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x0514000401000007c25b6587021301000007c25b6587020016040d010204010100a10f26020100a10f14010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c462cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    instructions: {},
    messageHash: '0x400e1e903c04bcee4d4289585ef56a0aa302faa7023889733ebdf0437f3454a3',
    messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  },
  destination: { chainId: 'urn:ocn:polkadot:1000' },
}

const kusamaBridgeHubReceive: XcmInbound = {
  chainId: 'urn:ocn:kusama:1002',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
      origin: {},
      weight_used: {},
      success: true,
    },
    blockNumber: '6652869',
    blockHash: '0x35d6a91e6fbef8888385d47ff75337d6cd799ecebbb1eea28979d1fef2ac631b',
    blockPosition: 12,
    specVersion: 1007001,
    timestamp: 1759217988000,
  },
  txPosition: undefined,
  blockNumber: '6652869',
  blockHash: '0x35d6a91e6fbef8888385d47ff75337d6cd799ecebbb1eea28979d1fef2ac631b',
  specVersion: 1007001,
  timestamp: 1759217988000,
  messageHash: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  messageData: undefined,
  messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  txHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
  assetSwaps: undefined,
}

const kusamaBridgeHubAccepted: XcmBridgeAcceptedWithContext = {
  event: {
    module: 'BridgePolkadotMessages',
    name: 'MessageAccepted',
    value: { lane_id: '0x00000001', nonce: '1560' },
    blockNumber: '6652869',
    blockHash: '0x35d6a91e6fbef8888385d47ff75337d6cd799ecebbb1eea28979d1fef2ac631b',
    blockPosition: 8,
    specVersion: 1007001,
    timestamp: 1759217988000,
  },
  messageHash: '0xb26df222f5cb997caba643cf08844957ca346a9fe0e16c0489d4b5033b6ddca1',
  messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  messageData:
    '0x051c2509030b0100a10f010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  blockHash: '0x35d6a91e6fbef8888385d47ff75337d6cd799ecebbb1eea28979d1fef2ac631b',
  blockNumber: '6652869',
  specVersion: undefined,
  timestamp: 1759217988000,
  txPosition: undefined,
  txHash: undefined,
  chainId: 'urn:ocn:kusama:1002',
  channelId: '0x00000001',
  nonce: '1560',
  recipient: 'urn:ocn:polkadot:1000',
  instructions: {},
}

const polkadotBridgeHubReceive: XcmBridgeInboundWithContext = {
  blockNumber: '6100146',
  blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
  chainId: 'urn:ocn:polkadot:1002',
  channelId: '0x00000001',
  nonce: '1560',
  outcome: 'Success',
  error: null,
  event: {
    module: 'BridgeKusamaMessages',
    name: 'MessagesReceived',
    value: { lane: '0x00000001', receive_results: {} },
    blockNumber: '6100146',
    blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
    blockPosition: 4,
    specVersion: 1006001,
    timestamp: 1759218336000,
    extrinsic: {
      module: 'BridgeKusamaMessages',
      method: 'receive_messages_proof',
      args: {},
      signed: true,
      address: {},
      signature: {},
      hash: '0x51454fb239adcdaffdb486e51e9c8016feec260a09f92835c53d0f1baaff0882',
      blockNumber: '6100146',
      blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
      blockPosition: 2,
      specVersion: 1006001,
      timestamp: 1759218336000,
    },
    extrinsicPosition: 2,
  },
  txPosition: 2,
  specVersion: undefined,
  timestamp: 1759218336000,
  txHash: '0x51454fb239adcdaffdb486e51e9c8016feec260a09f92835c53d0f1baaff0882',
}

const polkadotBridgeHubOutbound: XcmSent = {
  originProtocol: 'xcm',
  destinationProtocol: 'xcm',
  legs: [
    {
      from: 'urn:ocn:polkadot:1002',
      to: 'urn:ocn:polkadot:1000',
      type: 'hrmp',
      partialMessage: undefined,
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  sender: {
    signer: {
      id: '1W4WxmnXHU1cMVXuT8qmp9XSxQyzNQNu4mMB9PeNg32JdBF',
      publicKey: '0x1629f45fd0f1bdbfcd46142c8519e4da2967832e025b30232bddc8bba699ec7a',
    },
    extraSigners: [],
  },
  messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:1002',
    blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
    blockNumber: '6100146',
    txHash: '0x51454fb239adcdaffdb486e51e9c8016feec260a09f92835c53d0f1baaff0882',
    specVersion: 1006001,
    timestamp: 1759218336000,
    txPosition: 1,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {},
      blockNumber: '6100146',
      blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
      blockPosition: 3,
      specVersion: 1006001,
      timestamp: 1759218336000,
      extrinsic: {},
      extrinsicPosition: 1,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x05200b0104352509030b0100a10f010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    instructions: {},
    messageHash: '0xfd5834b633b78053fefa6ff109a03592cc743bda6e92a6d142cc3bfb5d7f4c78',
    messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:1002',
    blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
    blockNumber: '6100146',
    txHash: '0x51454fb239adcdaffdb486e51e9c8016feec260a09f92835c53d0f1baaff0882',
    specVersion: 1006001,
    timestamp: 1759218336000,
    txPosition: 1,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {},
      blockNumber: '6100146',
      blockHash: '0x1030a342ee49feee702a544242daa765adc7d22b25e6fee1cf6b6fd2f3e10fb8',
      blockPosition: 3,
      specVersion: 1006001,
      timestamp: 1759218336000,
      extrinsic: {},
      extrinsicPosition: 1,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x05200b0104352509030b0100a10f010402010903000bbd279d43c7cf0a1302010903000bbd279d43c7cf000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
    instructions: {},
    messageHash: '0xfd5834b633b78053fefa6ff109a03592cc743bda6e92a6d142cc3bfb5d7f4c78',
    messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  },
  destination: { chainId: 'urn:ocn:polkadot:1000' },
}

const polkadotAssetHubReceive: XcmInbound = {
  chainId: 'urn:ocn:polkadot:1000',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
      origin: {},
      weight_used: {},
      success: true,
    },
    blockNumber: '9782605',
    blockHash: '0x189358f2e8f6455ad3e46164df891c3d2c0e26343dafcd5fd4353dc7aefa13a4',
    blockPosition: 8,
    specVersion: 1006000,
    timestamp: 1759218348000,
  },
  txPosition: undefined,
  blockNumber: '9782605',
  blockHash: '0x189358f2e8f6455ad3e46164df891c3d2c0e26343dafcd5fd4353dc7aefa13a4',
  specVersion: 1006000,
  timestamp: 1759218348000,
  messageHash: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  messageData: undefined,
  messageId: '0xc09c41eba05e7b58ddfdcc58bdf06a2589c78119a7da9a68bb4d71ba03201c46',
  txHash: undefined,
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined,
  assetSwaps: undefined,
}

export const kusamaToPolkadotBridgeMessages = {
  sent: kusamaAssetHubSent,
  bridgeXcmIn: kusamaBridgeHubReceive,
  bridgeAccepted: kusamaBridgeHubAccepted,
  bridgeReceived: polkadotBridgeHubReceive,
  bridgeXcmOut: polkadotBridgeHubOutbound,
  received: polkadotAssetHubReceive,
}

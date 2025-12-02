import { XcmBridge, XcmSent } from '@/services/agents/xcm/lib.js'
import { fromXcmpFormat } from '@/services/agents/xcm/ops/xcm-format.js'
import { apiContext } from './xcm.js'

export function getXcmV5Sent(): XcmSent {
  const msgData =
    '000514000401000007027f6a8d021301000007027f6a8d020016040d010204010100a10f26020100a10f1c0104020109030007c5e5381c1130020109030007c5e5381c112e02020903007d1f1608140d010002020903007d1f0004010000baf7584931010100dd1f01010004010000baf758490100081608140d0100000101006d6f646c70792f74727372790000000000000000000000000000000000000000060100c43807f247154e097b9fe188c89fd9a37566a484918e4102abed13426487d916c681640f00a0fb02338d0a01010100a10f7c2c1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc2c1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc'
  const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
  const instructions = fromXcmpFormat(buf, apiContext)[0].instructions
  return {
    originProtocol: 'xcm',
    destinationProtocol: 'xcm',
    legs: [
      {
        from: 'urn:ocn:kusama:1000',
        to: 'urn:ocn:kusama:1002',
        type: 'hrmp',
        partialMessage: undefined,
        relay: 'urn:ocn:kusama:0',
      },
    ],
    sender: undefined,
    messageId: '0x1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc',
    type: 'xcm.sent',
    waypoint: {
      chainId: 'urn:ocn:kusama:1000',
      blockHash: '0x2244e6b8b2ea38fa139e165e07d6161075209872cb4f4eb259677fd2cc3481fc',
      blockNumber: '11218382',
      txHash: undefined,
      specVersion: 1009001,
      timestamp: 1760298288000,
      txPosition: undefined,
      event: {},
      outcome: 'Success',
      error: null,
      messageData: `0x${msgData}`,
      instructions,
      messageHash: '0xa26ec5d6b2c24cf0b9968bd4acc39dd88b6ffab5cc4cdfdfd9b5b38e6fd80767',
      messageId: '0x1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc',
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:kusama:1000',
      blockHash: '0x2244e6b8b2ea38fa139e165e07d6161075209872cb4f4eb259677fd2cc3481fc',
      blockNumber: '11218382',
      txHash: undefined,
      specVersion: 1009001,
      timestamp: 1760298288000,
      txPosition: undefined,
      event: {},
      outcome: 'Success',
      error: null,
      messageData: `0x${msgData}`,
      instructions,
      messageHash: '0xa26ec5d6b2c24cf0b9968bd4acc39dd88b6ffab5cc4cdfdfd9b5b38e6fd80767',
      messageId: '0x1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc',
    },
    destination: { chainId: 'urn:ocn:kusama:1002' },
  }
}

export function getSnowbridgeXcmBridge(version: number) {
  const v1Msg: XcmBridge = {
    legs: [
      {
        from: 'urn:ocn:ethereum:1',
        to: 'urn:ocn:polkadot:1002',
        type: 'bridge',
      },
      {
        from: 'urn:ocn:polkadot:1002',
        to: 'urn:ocn:polkadot:1000',
        relay: 'urn:ocn:polkadot:0',
        type: 'hop',
      },
      {
        from: 'urn:ocn:polkadot:1000',
        to: 'urn:ocn:polkadot:2034',
        relay: 'urn:ocn:polkadot:0',
        type: 'hrmp',
      },
    ],
    originProtocol: 'snowbridge',
    destinationProtocol: 'xcm',
    sender: {
      signer: {
        id: '0x628119c736c0e8FF28Bd2F42920a4682bd6FeB7b',
        publicKey: '0x628119c736c0e8FF28Bd2F42920a4682bd6FeB7b',
      },
      extraSigners: [],
    },
    messageId: '0xfbc8fad8cadd1e4b0480ed209d224eb01c1989c5ac2bff446c95b805523b9222',
    partialHumanized: {
      beneficiary: '0x40a83d12935d84425c18fdcfa068fe8c20588303b22136fcc3e2b003260d7216',
      assets: [
        {
          chainId: 'urn:ocn:ethereum:1',
          id: '0x57e114B691Db790C35207b2e685D4A43181e6061',
          amount: '8758139999999999606784',
        },
      ],
    },
    type: 'xcm.bridge',
    bridgeStatus: 'accepted',
    nonce: '9424',
    bridgeName: 'snowbridge',
    waypoint: {
      chainId: 'urn:ocn:ethereum:1',
      blockHash: '0xa6d20f6f5ae8887c996ef8ebf26201ca50af1967a89540f84eab6e8637427afa',
      timestamp: 1764666779000,
      blockNumber: '23924809',
      event: {},
      txHash: '0xefed3ecee2d6daa10b4b936e69b35ce04feb5c14ab99bf66e8ab3438db727607',
      txPosition: 260,
      messageData:
        '0x0001000000000000000157e114b691db790c35207b2e685d4a43181e606101f207000040a83d12935d84425c18fdcfa068fe8c20588303b22136fcc3e2b003260d7216fc7672120000000000000000000000000000a0b362c79bc7da0100000000000000ca9a3b000000000000000000000000',
      messageHash: '0x41cfd27bbca0d7694a540062aaebf1932f06eecc496e2be66d346703f31274e4',
      outcome: 'Success',
      error: null,
      instructions: undefined,
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:ethereum:1',
      blockHash: '0xa6d20f6f5ae8887c996ef8ebf26201ca50af1967a89540f84eab6e8637427afa',
      timestamp: 1764666779000,
      blockNumber: '23924809',
      event: {},
      txHash: '0xefed3ecee2d6daa10b4b936e69b35ce04feb5c14ab99bf66e8ab3438db727607',
      txPosition: 260,
      messageData:
        '0x0001000000000000000157e114b691db790c35207b2e685d4a43181e606101f207000040a83d12935d84425c18fdcfa068fe8c20588303b22136fcc3e2b003260d7216fc7672120000000000000000000000000000a0b362c79bc7da0100000000000000ca9a3b000000000000000000000000',
      messageHash: '0x41cfd27bbca0d7694a540062aaebf1932f06eecc496e2be66d346703f31274e4',
      outcome: 'Success',
      error: null,
      instructions: undefined,
    },
    destination: { chainId: 'urn:ocn:polkadot:2034' },
    channelId: '0xc173fac324158e77fb5840738a1a541f633cbec8884c6a601c567d2b376a0539',
    version: 1,
  }

  if (version === 1) {
    return v1Msg
  }

  throw new Error('Version not supported')
}

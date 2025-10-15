import { XcmSent } from '@/services/agents/xcm/lib.js'
import { fromXcmpFormat } from '@/services/agents/xcm/ops/xcm-format.js'
import { apiContext } from './xcm.js'

export function getXcmV5Sent(): XcmSent {
  const msgData =
    '000514000401000007027f6a8d021301000007027f6a8d020016040d010204010100a10f26020100a10f1c0104020109030007c5e5381c1130020109030007c5e5381c112e02020903007d1f1608140d010002020903007d1f0004010000baf7584931010100dd1f01010004010000baf758490100081608140d0100000101006d6f646c70792f74727372790000000000000000000000000000000000000000060100c43807f247154e097b9fe188c89fd9a37566a484918e4102abed13426487d916c681640f00a0fb02338d0a01010100a10f7c2c1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc2c1b45fd25e1f3ddba7793a8c45289c3b17049c003c93e286e20e27ee2c5bafccc'
  const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
  const instructions = fromXcmpFormat(buf, apiContext)[0].instructions
  return {
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
      extrinsicHash: undefined,
      specVersion: 1009001,
      timestamp: 1760298288000,
      extrinsicPosition: undefined,
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
      extrinsicHash: undefined,
      specVersion: 1009001,
      timestamp: 1760298288000,
      extrinsicPosition: undefined,
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

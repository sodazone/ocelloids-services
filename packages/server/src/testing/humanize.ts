import { toHex } from 'polkadot-api/utils'
import { XcmBridge, XcmSent } from '@/services/agents/xcm/lib.js'
import { fromXcmpFormat } from '@/services/agents/xcm/ops/xcm-format.js'
import { HexString } from '@/services/subscriptions/types.js'
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

export function getHydrationWormholeBridgeRelayerXcm(): XcmSent {
  const msgData =
    '00041400080001040a0013000064a7b3b6e00d0002046e0300931715fee2d06333043d11f658c8ce934ac61d0c00075475e903170a130001040a0013000064a7b3b6e00d000d0102080001030021c0477815d339945f87ec4d162c253e1ef4244f2c4e9937120dd1431b6322bce3d13b6dff72b6b282a0fa372d29d65965d97a8315041c0b0101010245544800b5fb748ec3e019a7ed4f6f701158bc23fa3a2626000000000000000000040001040a00130000da493b717d0c130001040a00130000da493b717d0c0006010768361c1e1da2252600810e6d0000404b4c0000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000008080000000000000000000000000000000000000000000000000000000000000000110d96e292b8000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000931715fee2d06333043d11f658c8ce934ac61d0c000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000001703e975540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c41019d654000000000000000000000000931715fee2d06333043d11f658c8ce934ac61d0c0000000000000000000000000000000000000000000000000000001703e9755400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000b5fb748ec3e019a7ed4f6f701158bc23fa3a2626000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140d0102040001030021c0477815d339945f87ec4d162c253e1ef4244f2c0ff73459f387bdbe8009c43cf3f427ddf08b6d0f1b6daaf8b3c5f9408ff8816d'
  const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
  const xcmp = fromXcmpFormat(buf, apiContext)[1]
  const instructions = xcmp.instructions
  const messageData = toHex(xcmp.data) as HexString

  return {
    legs: [
      {
        from: 'urn:ocn:polkadot:2034',
        to: 'urn:ocn:polkadot:2004',
        type: 'hrmp',
        partialMessage: undefined,
        relay: 'urn:ocn:polkadot:0',
      },
    ],
    originProtocol: 'xcm',
    destinationProtocol: 'xcm',
    sender: {
      signer: {
        id: '0xb5fb748EC3e019A7Ed4F6F701158bc23FA3a2626',
        publicKey: '0xb5fb748ec3e019a7ed4f6f701158bc23fa3a2626',
      },
      extraSigners: [],
    },
    messageId: '0x0ff73459f387bdbe8009c43cf3f427ddf08b6d0f1b6daaf8b3c5f9408ff8816d',
    partialHumanized: undefined,
    type: 'xcm.sent',
    waypoint: {
      chainId: 'urn:ocn:polkadot:2034',
      blockHash: '0x0abdb945dc2956fb0fe1ce07dcbd217969f287100443e2c01f83e1f42e07e3cc',
      blockNumber: '10556625',
      txHash: '0xbfb0fe1a683bde36c7bf58621b4a7f6053d6808f794c248fa31bdd73a7823768',
      extrinsicHash: '0xbfb0fe1a683bde36c7bf58621b4a7f6053d6808f794c248fa31bdd73a7823768',
      specVersion: 359,
      timestamp: 1766047494000,
      txPosition: 2,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0xcd5ad96e08999a9a5f13b872c70e14d399bf311dc9039ddaae0e38d618ff42a7',
      messageId: '0x0ff73459f387bdbe8009c43cf3f427ddf08b6d0f1b6daaf8b3c5f9408ff8816d',
      connectionId: undefined,
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:polkadot:2034',
      blockHash: '0x0abdb945dc2956fb0fe1ce07dcbd217969f287100443e2c01f83e1f42e07e3cc',
      blockNumber: '10556625',
      txHash: '0xbfb0fe1a683bde36c7bf58621b4a7f6053d6808f794c248fa31bdd73a7823768',
      extrinsicHash: '0xbfb0fe1a683bde36c7bf58621b4a7f6053d6808f794c248fa31bdd73a7823768',
      specVersion: 359,
      timestamp: 1766047494000,
      txPosition: 2,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0xcd5ad96e08999a9a5f13b872c70e14d399bf311dc9039ddaae0e38d618ff42a7',
      messageId: '0x0ff73459f387bdbe8009c43cf3f427ddf08b6d0f1b6daaf8b3c5f9408ff8816d',
      connectionId: undefined,
    },
    destination: { chainId: 'urn:ocn:polkadot:2004' },
  }
}

export function getHydrationWormholeTokenBridgeXcm(): XcmSent {
  const msgData =
    '00041400080001040a0013000064a7b3b6e00d0002046e0300e9f9a2e3deae4093c00fbc57b22bb51a4c05ad880012a888100a130001040a0013000064a7b3b6e00d000d01020800010300dfdd0ec42fedc572d50430533fc121d5da9106252c9e30e124530483d0a15fee8cb3fb5e2fe7c14a8c11decee187a00a38e1a2849e041c0b01010102367d22bd87d055c6e9483017dea6b42bac61bcc559c8d311fb70a0767e6eb70c00040001040a00130000da493b717d0c130001040a00130000da493b717d0c0006010768361c1e1da2252600810e6d0000404b4c0000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000008080000000000000000000000000000000000000000000000000000000000000000110d96e292b8000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e9f9a2e3deae4093c00fbc57b22bb51a4c05ad88000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d920000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d920000000000000000000000000000000000000000000000000000000004222a040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c40f5287b0000000000000000000000000e9f9a2e3deae4093c00fbc57b22bb51a4c05ad880000000000000000000000000000000000000000000000000000000004222a04000000000000000000000000000000000000000000000000000000000000000170cfd407913ed959b6eacf1e33644f66d01965e6f7aef8c0657d999ebce121780000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140d01020400010300dfdd0ec42fedc572d50430533fc121d5da9106252c6a469fdb61711b56850917c32d969c3e8ade400611fe207913c7e5759031850c'
  const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
  const xcmp = fromXcmpFormat(buf, apiContext)[1]
  const instructions = xcmp.instructions
  const messageData = toHex(xcmp.data) as HexString

  return {
    legs: [
      {
        from: 'urn:ocn:polkadot:2034',
        to: 'urn:ocn:polkadot:2004',
        type: 'hrmp',
        partialMessage: undefined,
        relay: 'urn:ocn:polkadot:0',
      },
    ],
    originProtocol: 'xcm',
    destinationProtocol: 'xcm',
    sender: {
      signer: {
        id: '12ESm1kMkiKZxtLV4rVpNAJ8MwJvDtRkLpxM9qZebdnL2Sbb',
        publicKey: '0x367d22bd87d055c6e9483017dea6b42bac61bcc559c8d311fb70a0767e6eb70c',
      },
      extraSigners: [],
    },
    messageId: '0x6a469fdb61711b56850917c32d969c3e8ade400611fe207913c7e5759031850c',
    partialHumanized: undefined,
    type: 'xcm.sent',
    waypoint: {
      chainId: 'urn:ocn:polkadot:2034',
      blockHash: '0xa4ffd2b02845af2a4ee6ae22645c6e34e457a73aa72f7ac2c5e0ff19669f8ae7',
      blockNumber: '10951081',
      txHash: '0x5786cc1ce047d87dc9360fe4c9a5b34cd784e0bd3e4db48f6a3022d0be8b4974',
      extrinsicHash: '0x5786cc1ce047d87dc9360fe4c9a5b34cd784e0bd3e4db48f6a3022d0be8b4974',
      specVersion: 360,
      timestamp: 1768473774000,
      txPosition: 2,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0x610aee03c307a52d7a4e8a89b90ac9da2021d558c7597b6063fdde9371f44da4',
      messageId: '0x6a469fdb61711b56850917c32d969c3e8ade400611fe207913c7e5759031850c',
      connectionId: undefined,
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:polkadot:2034',
      blockHash: '0xa4ffd2b02845af2a4ee6ae22645c6e34e457a73aa72f7ac2c5e0ff19669f8ae7',
      blockNumber: '10951081',
      txHash: '0x5786cc1ce047d87dc9360fe4c9a5b34cd784e0bd3e4db48f6a3022d0be8b4974',
      extrinsicHash: '0x5786cc1ce047d87dc9360fe4c9a5b34cd784e0bd3e4db48f6a3022d0be8b4974',
      specVersion: 360,
      timestamp: 1768473774000,
      txPosition: 2,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0x610aee03c307a52d7a4e8a89b90ac9da2021d558c7597b6063fdde9371f44da4',
      messageId: '0x6a469fdb61711b56850917c32d969c3e8ade400611fe207913c7e5759031850c',
      connectionId: undefined,
    },
    destination: { chainId: 'urn:ocn:polkadot:2004' },
  }
}

export function getBifrostEthereumXcmTransact(): XcmSent {
  const msgData =
    '00051800040001040a0013000014bbf08ac602130001040a0013000014bbf08ac602000601010700c817a80442420f00fd026d000180fc0a000000000000000000000000000000000000000000000000000000000000ef81930aa8ed07c17948b2e26b7bfaf20144ef2a000000000000000000000000000000000000000000000000000000000000000091019a41b92408080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc51baaa407774935c4e1000000000000000000000000000000000000000000097a4b980cf091a9c1f6fa00140d010220000103007369626cee0700000000000000000000000000002c65e226042c33660d3604c598db1d6bd55c523c4ab10deb1e84441eb9627734aa'
  const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
  const xcmp = fromXcmpFormat(buf, apiContext)[0]
  const instructions = xcmp.instructions
  const messageData = toHex(xcmp.data) as HexString

  return {
    legs: [
      {
        from: 'urn:ocn:polkadot:2030',
        to: 'urn:ocn:polkadot:2004',
        type: 'hrmp',
        partialMessage: undefined,
        relay: 'urn:ocn:polkadot:0',
      },
    ],
    originProtocol: 'xcm',
    destinationProtocol: 'xcm',
    sender: undefined,
    messageId: '0x65e226042c33660d3604c598db1d6bd55c523c4ab10deb1e84441eb9627734aa',
    partialHumanized: undefined,
    type: 'xcm.sent',
    waypoint: {
      chainId: 'urn:ocn:polkadot:2030',
      blockHash: '0x316dd6458f06ec1026449b9e13fd471973c67c8afe18faddf5c02be07f8579a2',
      blockNumber: '10398242',
      txHash: undefined,
      extrinsicHash: undefined,
      specVersion: 22002,
      timestamp: 1766060502000,
      txPosition: undefined,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0xf948ce28da55eefb028a8d0091b1291f78378ed58119dfefa40185a2918ac2dd',
      messageId: '0x65e226042c33660d3604c598db1d6bd55c523c4ab10deb1e84441eb9627734aa',
      connectionId: undefined,
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:polkadot:2030',
      blockHash: '0x316dd6458f06ec1026449b9e13fd471973c67c8afe18faddf5c02be07f8579a2',
      blockNumber: '10398242',
      txHash: undefined,
      extrinsicHash: undefined,
      specVersion: 22002,
      timestamp: 1766060502000,
      txPosition: undefined,
      event: {},
      outcome: 'Success',
      error: null,
      messageData,
      instructions,
      messageHash: '0xf948ce28da55eefb028a8d0091b1291f78378ed58119dfefa40185a2918ac2dd',
      messageId: '0x65e226042c33660d3604c598db1d6bd55c523c4ab10deb1e84441eb9627734aa',
      connectionId: undefined,
    },
    destination: { chainId: 'urn:ocn:polkadot:2004' },
  }
}

import {
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
  XcmInbound,
  XcmNotificationType,
  XcmRelayedWithContext,
  XcmSent,
} from '@/services/agents/xcm/types.js'

type MatchBridgeMessages = {
  subscriptionId: string
  origin: XcmSent
  relay0: XcmRelayedWithContext
  bridgeXcmIn: XcmInbound
  bridgeAccepted: XcmBridgeAcceptedWithContext
  bridgeDelivered: XcmBridgeDeliveredWithContext
  bridgeIn: XcmBridgeInboundWithContext
  bridgeXcmOut: XcmSent
  relay1: XcmRelayedWithContext
  destination: XcmInbound
}

const subscriptionId = 'bridge-test'
export const matchBridgeMessages: MatchBridgeMessages = {
  subscriptionId,
  origin: {
    type: XcmNotificationType.Sent,
    legs: [
      {
        from: 'urn:ocn:kusama:1000',
        to: 'urn:ocn:kusama:1002',
        type: 'hrmp',
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
        relay: 'urn:ocn:polkadot:0',
      },
    ],
    origin: {
      chainId: 'urn:ocn:kusama:1000',
      blockHash: '0x01',
      blockNumber: '32',
      extrinsicId: '32-4',
      event: {},
      outcome: 'Success',
      error: null,
      messageData:
        '0x0003180004000100000740568a4a5f13000100000740568a4a5f0026020100a10f1401040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab140d0100010100a10f2c4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
      instructions: {},
      messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
    },
    waypoint: {
      chainId: 'urn:ocn:kusama:1000',
      blockHash: '0x01',
      blockNumber: '32',
      extrinsicId: '32-4',
      event: {},
      outcome: 'Success',
      error: null,
      messageData:
        '0x0003180004000100000740568a4a5f13000100000740568a4a5f0026020100a10f1401040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab140d0100010100a10f2c4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
      instructions: {},
      messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
      legIndex: 0,
    },
    subscriptionId,
    destination: { chainId: 'urn:ocn:polkadot:1000' },
    sender: {
      signer: {
        id: 'Dax95Nps5EEVfw7eQ2mvB3bX8p2hX2ZCtYSLiA357ZRq3aK',
        publicKey: '0x2cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee37',
      },
      extraSigners: [],
    },
    messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
  },
  relay0: {
    event: undefined,
    extrinsicId: '22648011-1',
    blockNumber: '22648011',
    blockHash: '0x088f00fb7cbeee77dabaeac12b21faff63d22ab16d3bcd297f3b6874519edac9',
    messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
    messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
    recipient: 'urn:ocn:kusama:1002',
    origin: 'urn:ocn:kusama:1000',
    outcome: 'Success',
    error: null,
  },
  bridgeXcmIn: {
    subscriptionId,
    chainId: 'urn:ocn:kusama:1002',
    event: {
      eventId: '3076892-4',
      blockPosition: 4,
      blockNumber: '3,076,892',
      blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
      method: 'Success',
      section: 'xcmpQueue',
      index: '0x1e00',
      data: {
        messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
        messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
        weight: {},
      },
    },
    extrinsicId: undefined,
    blockNumber: '3076892',
    blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
    messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
    messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
    outcome: 'Success',
    error: undefined,
    assetsTrapped: undefined,
  },
  bridgeAccepted: {
    chainId: 'urn:ocn:kusama:1002',
    bridgeKey: '0x000000010100000000000000',
    messageData:
      '0x031c2509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
    recipient: 'urn:ocn:polkadot:1000',
    instructions: {},
    messageHash: '0xd20ec7c40bffddbc725c6f8a513daac289eff67fc8c50327f8133035402829d2',
    event: {
      eventId: '3076892-1',
      blockPosition: 1,
      blockNumber: '3,076,892',
      blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
      method: 'MessageAccepted',
      section: 'bridgePolkadotMessages',
      index: '0x3500',
      data: { laneId: '0x00000001', nonce: '1' },
    },
    blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
    blockNumber: '3076892',
    extrinsicId: undefined,
    messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
    forwardId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
  },
  bridgeDelivered: {
    chainId: 'urn:ocn:kusama:1002',
    bridgeKey: '0x000000010100000000000000',
    event: {
      extrinsicId: '3076900-2',
      extrinsicPosition: 5,
      extrinsic: {
        extrinsicId: '3076900-2',
        blockNumber: '3,076,900',
        blockHash: '0x79242237c34c9cfc1f4eed26f335ca602bdc3e69ff93225d0b84d196dd8591ea',
        position: 2,
        extraSigners: [],
        isSigned: true,
        signature:
          '0xce0a6660e69ad7c1c90fabc109f182efa1cbc1ce1dcd495abd0b835cb6fd0a365422f14e7ba0551a6afbacbab04f75b7f7084c2b22dd07ce1ffff0e25fbc988c',
        tip: '0',
      },
      eventId: '3076900-8',
      blockPosition: 8,
      blockNumber: '3,076,900',
      blockHash: '0x79242237c34c9cfc1f4eed26f335ca602bdc3e69ff93225d0b84d196dd8591ea',
      method: 'MessagesDelivered',
      section: 'bridgePolkadotMessages',
      index: '0x3502',
      data: { laneId: '0x00000001', messages: [] },
    },
    extrinsicId: '3076900-2',
    blockNumber: '3076900',
    blockHash: '0x79242237c34c9cfc1f4eed26f335ca602bdc3e69ff93225d0b84d196dd8591ea',
    sender: {
      signer: {
        id: 'HppRiCoXkhb1URsL2qWyaCqA3cigAgDBsPZWWbY3gx1kcNv',
        publicKey: '0xe83beb66f2da17cc51a48dda94136e98e28eee1123611f533b3b22fd195c9b6b',
      },
      extraSigners: [],
    },
  },
  bridgeIn: {
    chainId: 'urn:ocn:polkadot:1002',
    bridgeKey: '0x000000010100000000000000',
    event: {
      extrinsicId: '2340207-2',
      extrinsicPosition: 6,
      extrinsic: {
        extrinsicId: '2340207-2',
        blockNumber: '2,340,207',
        blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
      },
      eventId: '2340207-8',
      blockPosition: 8,
      blockNumber: '2,340,207',
      blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
      method: 'MessagesReceived',
      section: 'bridgeKusamaMessages',
      index: '0x3501',
    },
    extrinsicId: '2340207-2',
    blockNumber: '2340207',
    blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
    outcome: 'Success',
    error: null,
  },
  bridgeXcmOut: {
    type: XcmNotificationType.Sent,
    subscriptionId,
    legs: [
      {
        from: 'urn:ocn:polkadot:1002',
        to: 'urn:ocn:polkadot:1000',
        type: 'hrmp',
        relay: 'urn:ocn:polkadot:0',
      },
    ],
    waypoint: {
      chainId: 'urn:ocn:polkadot:1002',
      blockHash: '0x01',
      blockNumber: '32',
      extrinsicId: '32-4',
      event: {},
      outcome: 'Success',
      error: null,
      messageData:
        '0x0003200b0104352509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
      instructions: {},
      messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
      legIndex: 0,
    },
    origin: {
      chainId: 'urn:ocn:polkadot:1002',
      blockHash: '0x01',
      blockNumber: '32',
      extrinsicId: '32-4',
      event: {},
      outcome: 'Success',
      error: null,
      messageData:
        '0x0003200b0104352509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
      instructions: {},
      messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
    },
    destination: { chainId: 'urn:ocn:polkadot:1000' },
    sender: {
      signer: {
        id: '1W4WxmnXHU1cMVXuT8qmp9XSxQyzNQNu4mMB9PeNg32JdBF',
        publicKey: '0x1629f45fd0f1bdbfcd46142c8519e4da2967832e025b30232bddc8bba699ec7a',
      },
      extraSigners: [],
    },
    messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
    forwardId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
  },
  relay1: {
    event: undefined,
    extrinsicId: '20252960-1',
    blockNumber: '20252960',
    blockHash: '0xb3527df9a1f18c0adeebf3455f6979479b482be6c0f2eab1bdd1aa842bff0449',
    messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
    messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
    recipient: 'urn:ocn:polkadot:1000',
    origin: 'urn:ocn:polkadot:1002',
    outcome: 'Success',
    error: null,
  },
  destination: {
    subscriptionId,
    chainId: 'urn:ocn:polkadot:1000',
    event: {
      eventId: '6019226-3',
      blockPosition: 3,
      blockNumber: '6,019,226',
      blockHash: '0x61cb784a7c3491e0e14aeb9c0417b123d2708a2ef633db3f7a4e516b02ee230c',
      method: 'Success',
      section: 'xcmpQueue',
      index: '0x1e00',
      data: {
        messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
        messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
      },
    },
    extrinsicId: undefined,
    blockNumber: '6019226',
    blockHash: '0x61cb784a7c3491e0e14aeb9c0417b123d2708a2ef633db3f7a4e516b02ee230c',
    messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
    messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
    outcome: 'Success',
    error: undefined,
    assetsTrapped: undefined,
  },
}

import {
  XcmInbound,
  XcmNotificationType,
  XcmRelayedWithContext,
  XcmSent,
  XcmTerminiContext,
} from '../services/monitoring/types';

const subscriptionId = 'manamana-1';

const originContext: XcmTerminiContext = {
  chainId: '1000',
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
  outcome: 'Success',
  error: null,
};

const outboundMessage: XcmSent = {
  type: XcmNotificationType.Sent,
  messageId: '0xB000',
  legs: [
    {
      from: '1000',
      to: '0',
    },
    {
      from: '0',
      to: '2000',
    },
  ],
  destination: {
    chainId: '2000',
  },
  origin: originContext,
  waypoint: {
    ...originContext,
    legIndex: 0,
    instructions: {},
    messageData: '0x0',
    messageHash: '0xCAFE',
  },
  subscriptionId: subscriptionId,
  sender: {
    id: '0x123',
  },
};

const inboundMessage: XcmInbound = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  chainId: '2000',
  outcome: 'Success',
  error: null,
  event: {},
  subscriptionId: subscriptionId,
  blockHash: '0xBEEF',
  blockNumber: '2',
};

const relayMessage: XcmRelayedWithContext = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  extrinsicId: '5-1',
  blockHash: '0x828',
  blockNumber: '5',
  recipient: '2000',
  origin: '1000',
  outcome: 'Success',
  error: null,
};

export const matchMessages = {
  subscriptionId,
  origin: outboundMessage,
  relay: relayMessage,
  destination: inboundMessage,
};

type MatchHopMessages = {
  subscriptionId: string;
  origin: XcmSent;
  relay0: XcmRelayedWithContext;
  hopin: XcmInbound;
  hopout: XcmSent;
  relay2: XcmRelayedWithContext;
  destination: XcmInbound;
};

export const matchHopMessages: MatchHopMessages = {
  subscriptionId,
  origin: {
    ...outboundMessage,
    legs: [
      {
        from: '1000',
        to: '0',
      },
      {
        from: '0',
        to: '3000',
      },
      {
        from: '3000',
        to: '0',
      },
      {
        from: '0',
        to: '2000',
      },
    ],
  },
  relay0: {
    messageHash: '0xCAFE',
    messageId: '0xB000',
    extrinsicId: '5-1',
    blockHash: '0x828',
    blockNumber: '5',
    recipient: '3000',
    origin: '1000',
    outcome: 'Success',
    error: null,
  },
  hopin: {
    messageHash: '0xCAFE',
    messageId: '0xB000',
    chainId: '3000',
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
        from: '3000',
        to: '0',
      },
      {
        from: '0',
        to: '2000',
      },
    ],
    destination: {
      chainId: '2000',
    },
    origin: {
      chainId: '3000',
      event: {},
      blockHash: '0xBEEF',
      blockNumber: '2',
      outcome: 'Success',
      error: null,
    },
    waypoint: {
      chainId: '3000',
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
    recipient: '2000',
    origin: '3000',
    outcome: 'Success',
    error: null,
  },
  destination: {
    messageHash: '0xDEAD',
    messageId: '0xB000',
    chainId: '2000',
    outcome: 'Success',
    error: null,
    event: {},
    subscriptionId: subscriptionId,
    blockHash: '0xEEEE',
    blockNumber: '23',
  },
};

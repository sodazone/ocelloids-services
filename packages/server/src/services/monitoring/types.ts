import z from 'zod';

import { Subscription as RxSubscription } from 'rxjs';

import { ControlQuery } from '@sodazone/ocelloids';

/**
 * @public
 */
export type AnyJson =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnyJson[]
  | {
      [index: string]: AnyJson;
    };

export const $ChainHead = z.object({
  chainId: z.string().min(1),
  blockNumber: z.string().min(1),
  blockHash: z.string().min(1),
  parentHash: z.string().min(1),
  receivedAt: z.date(),
});

export type ChainHead = z.infer<typeof $ChainHead>;

export type BlockNumberRange = {
  fromBlockNum: string;
  toBlockNum: string;
};

export const $SafeId = z
  .string({
    required_error: 'id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9:.\-_]+/);

/**
 * A hex string starting with '0x'.
 *
 * @public
 */
export type HexString = `0x${string}`;

function toHexString(buf: Uint8Array): HexString {
  return `0x${Buffer.from(buf).toString('hex')}`;
}

export type XcmCriteria = {
  sendersControl: ControlQuery;
  messageControl: ControlQuery;
};

export type XcmWithContext = {
  event?: AnyJson;
  extrinsicId?: string;
  blockNumber: string | number;
  blockHash: HexString;
  messageHash: HexString;
  messageId?: HexString;
};

/**
 * Represents the asset that has been trapped.
 *
 * @public
 */
export type TrappedAsset = {
  version: number;
  id: {
    type: string;
    value: AnyJson;
  };
  fungible: boolean;
  amount: string | number;
  assetInstance?: AnyJson;
};

/**
 * Event emitted when assets are trapped.
 *
 * @public
 */
export type AssetsTrapped = {
  assets: TrappedAsset[];
  hash: HexString;
  event: AnyJson;
};

/**
 * Represents an XCM program bytes and human JSON.
 */
export type XcmProgram = {
  bytes: Uint8Array;
  json: AnyJson;
};

export interface XcmSentWithContext extends XcmWithContext {
  messageData: Uint8Array;
  recipient: string;
  sender: AnyJson;
  instructions: XcmProgram;
}

export interface XcmInboundWithContext extends XcmWithContext {
  outcome: 'Success' | 'Fail';
  error: AnyJson;
  assetsTrapped?: AssetsTrapped;
}

export interface XcmRelayedWithContext extends XcmInboundWithContext {
  recipient: string;
  origin: string;
}

export class GenericXcmRelayedWithContext implements XcmRelayedWithContext {
  event: AnyJson;
  extrinsicId?: string;
  blockNumber: string | number;
  blockHash: HexString;
  messageHash: HexString;
  messageId?: HexString;
  recipient: string;
  origin: string;
  outcome: 'Success' | 'Fail';
  error: AnyJson;

  constructor(msg: XcmRelayedWithContext) {
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId ?? msg.messageHash;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
    this.recipient = msg.recipient;
    this.origin = msg.origin;
    this.outcome = msg.outcome;
    this.error = msg.error;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      messageId: this.messageId,
      extrinsicId: this.extrinsicId,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      event: this.event,
      recipient: this.recipient,
      origin: this.origin,
      outcome: this.outcome,
      error: this.error,
    };
  }
}

export class GenericXcmInboundWithContext implements XcmInboundWithContext {
  event: AnyJson;
  extrinsicId?: string | undefined;
  blockNumber: string;
  blockHash: HexString;
  messageHash: HexString;
  messageId: HexString;
  outcome: 'Success' | 'Fail';
  error: AnyJson;
  assetsTrapped?: AssetsTrapped | undefined;

  constructor(msg: XcmInboundWithContext) {
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId ?? msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
    this.assetsTrapped = msg.assetsTrapped;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      messageId: this.messageId,
      extrinsicId: this.extrinsicId,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      event: this.event,
      outcome: this.outcome,
      error: this.error,
      assetsTrapped: this.assetsTrapped,
    };
  }
}

export class XcmInbound {
  subscriptionId: string;
  chainId: string;
  event: AnyJson;
  messageHash: HexString;
  messageId: HexString;
  outcome: 'Success' | 'Fail';
  error: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  extrinsicId?: string;
  assetsTrapped?: AssetsTrapped;

  constructor(subscriptionId: string, chainId: string, msg: XcmInboundWithContext) {
    this.subscriptionId = subscriptionId;
    this.chainId = chainId;
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId ?? msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
    this.assetsTrapped = msg.assetsTrapped;
  }
}

export class GenericXcmSentWithContext implements XcmSentWithContext {
  messageData: Uint8Array;
  recipient: string;
  instructions: XcmProgram;
  messageHash: HexString;
  event: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  sender: AnyJson;
  extrinsicId?: string;
  messageId?: HexString;

  constructor(msg: XcmSentWithContext) {
    this.event = msg.event;
    this.messageData = msg.messageData;
    this.recipient = msg.recipient;
    this.instructions = msg.instructions;
    this.messageHash = msg.messageHash;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
    this.messageId = msg.messageId;
    this.sender = msg.sender;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageData: toHexString(this.messageData),
      recipient: this.recipient,
      instructions: this.instructions.json,
      messageHash: this.messageHash,
      event: this.event,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      extrinsicId: this.extrinsicId,
      messageId: this.messageId,
      sender: this.sender,
    };
  }
}

export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Timeout = 'xcm.timeout',
  Hop = 'xcm.hop',
}

const XCM_NOTIFICATION_TYPE_ERROR = `at least 1 event type is required [${Object.values(XcmNotificationType).join(',')}]`;

/**
 * The terminal point of an XCM journey.
 *
 * @public
 */
export type XcmTerminus = {
  chainId: string;
};

/**
 * The terminal point of an XCM journey with contextual information.
 *
 * @public
 */
export interface XcmTerminusContext extends XcmTerminus {
  blockNumber: string;
  blockHash: HexString;
  extrinsicId?: string;
  event: AnyJson;
  outcome: 'Success' | 'Fail';
  error: AnyJson;
  messageHash: HexString;
  messageData: string;
  instructions: AnyJson;
}

/**
 * The contextual information of an XCM journey waypoint.
 *
 * @public
 */
export interface XcmWaypointContext extends XcmTerminusContext {
  legIndex: number;
  messageHash: HexString;
  messageData: string;
  instructions: AnyJson;
  assetsTrapped?: AnyJson;
}

/**
 * A leg of an XCM journey.
 *
 * @public
 */
export type Leg = {
  from: string;
  to: string;
};

/**
 * Event emitted when an XCM is sent.
 *
 * @public
 */
export interface XcmSent {
  type: XcmNotificationType;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminus;
  sender: AnyJson;
  messageId?: HexString;
}

export class GenericXcmSent implements XcmSent {
  type: XcmNotificationType = XcmNotificationType.Sent;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminus;
  sender: AnyJson;
  messageId?: HexString;

  constructor(subscriptionId: string, chainId: string, msg: XcmSentWithContext, stops: string[]) {
    this.subscriptionId = subscriptionId;
    this.legs = this.constructLegs(chainId, stops);
    this.origin = {
      chainId,
      blockHash: msg.blockHash,
      blockNumber: msg.blockNumber.toString(),
      extrinsicId: msg.extrinsicId,
      event: msg.event,
      outcome: 'Success',
      error: null,
      messageData: toHexString(msg.messageData),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    };
    this.destination = {
      chainId: stops[stops.length - 1], // last stop is the destination
    };
    this.waypoint = {
      ...this.origin,
      legIndex: 0,
      messageData: toHexString(msg.messageData),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    };

    this.messageId = msg.messageId;
    this.sender = msg.sender;
  }

  constructLegs(origin: string, stops: string[]) {
    const legs: Leg[] = [];
    const nodes = [origin].concat(stops);
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      // If OD are parachains, add intermediate path through relay.
      // TODO: revisit when XCMP is launched.
      if (from !== '0' && to !== '0') {
        legs.push(
          {
            from,
            to: '0',
          },
          {
            from: '0',
            to,
          }
        );
      } else {
        legs.push({
          from,
          to,
        });
      }
    }

    return legs;
  }
}

/**
 * Event emitted when an XCM is received.
 *
 * @public
 */
export interface XcmReceived {
  type: XcmNotificationType;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminusContext;
  sender: AnyJson;
  messageId?: HexString;
}

/**
 * Event emitted when an XCM is not received within a specified timeframe.
 *
 * @public
 */
export type XcmTimeout = XcmSent;

export class GenericXcmTimeout implements XcmTimeout {
  type: XcmNotificationType = XcmNotificationType.Timeout;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminus;
  sender: AnyJson;
  messageId?: HexString;

  constructor(msg: XcmSent) {
    this.subscriptionId = msg.subscriptionId;
    this.legs = msg.legs;
    this.origin = msg.origin;
    this.destination = msg.destination;
    this.waypoint = msg.waypoint;
    this.messageId = msg.messageId;
    this.sender = msg.sender;
  }
}

export class GenericXcmReceived implements XcmReceived {
  type: XcmNotificationType = XcmNotificationType.Received;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminusContext;
  sender: AnyJson;
  messageId?: HexString;

  constructor(outMsg: XcmSent, inMsg: XcmInbound) {
    this.subscriptionId = outMsg.subscriptionId;
    this.legs = outMsg.legs;
    this.destination = {
      chainId: inMsg.chainId,
      blockNumber: inMsg.blockNumber,
      blockHash: inMsg.blockHash,
      extrinsicId: inMsg.extrinsicId,
      event: inMsg.event,
      outcome: inMsg.outcome,
      error: inMsg.error,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
    };
    this.origin = outMsg.origin;
    this.waypoint = {
      ...this.destination,
      legIndex: this.legs.length - 1,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
      assetsTrapped: inMsg.assetsTrapped,
    };
    this.sender = outMsg.sender;
    this.messageId = outMsg.messageId;
  }
}

/**
 * Event emitted when an XCM is received on the relay chain
 * for an HRMP message.
 *
 * @public
 */
export type XcmRelayed = XcmSent;

export class GenericXcmRelayed implements XcmRelayed {
  type: XcmNotificationType = XcmNotificationType.Relayed;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminus;
  sender: AnyJson;
  messageId?: HexString;

  constructor(outMsg: XcmSent, relayMsg: XcmRelayedWithContext) {
    this.subscriptionId = outMsg.subscriptionId;
    this.legs = outMsg.legs;
    this.destination = outMsg.destination;
    this.origin = outMsg.origin;
    this.waypoint = {
      legIndex: outMsg.legs.findIndex((l) => l.from === relayMsg.origin && l.to === '0'),
      chainId: '0', // relay waypoint always at relay chain
      blockNumber: relayMsg.blockNumber.toString(),
      blockHash: relayMsg.blockHash,
      extrinsicId: relayMsg.extrinsicId,
      event: relayMsg.event,
      outcome: relayMsg.outcome,
      error: relayMsg.error,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
    };
    this.sender = outMsg.sender;
    this.messageId = outMsg.messageId;
  }
}

/**
 * Event emitted when an XCM is sent or received on an intermediate stop.
 *
 * @public
 */
export interface XcmHop extends XcmSent {
  direction: 'out' | 'in';
}

export class GenericXcmHop implements XcmHop {
  type: XcmNotificationType = XcmNotificationType.Hop;
  subscriptionId: string;
  legs: Leg[];
  waypoint: XcmWaypointContext;
  origin: XcmTerminusContext;
  destination: XcmTerminus;
  sender: AnyJson;
  direction: 'out' | 'in';
  messageId?: HexString;

  constructor(originMsg: XcmSent, hopWaypoint: XcmWaypointContext, direction: 'out' | 'in') {
    this.subscriptionId = originMsg.subscriptionId;
    this.legs = originMsg.legs;
    this.origin = originMsg.origin;
    this.destination = originMsg.destination;
    this.waypoint = hopWaypoint;
    this.messageId = originMsg.messageId;
    this.sender = originMsg.sender;
    this.direction = direction;
  }
}

/**
 * The XCM event types.
 *
 * @public
 */
export type XcmNotifyMessage = XcmSent | XcmReceived | XcmRelayed | XcmHop;

export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent;
}

export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received;
}

export function isXcmHop(object: any): object is XcmHop {
  return object.type !== undefined && object.type === XcmNotificationType.Hop;
}

export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed;
}

const $WebhookNotification = z.object({
  type: z.literal('webhook'),
  url: z
    .string()
    .min(5)
    .max(2_000)
    .regex(/https?:\/\/.*/),
  contentType: z.optional(
    z
      .string()
      .regex(/(?:application|text)\/[a-z0-9-+.]+/i)
      .max(250)
  ),
  // prevent using $refs
  events: z.optional(z.literal('*').or(z.array(z.nativeEnum(XcmNotificationType)).min(1, XCM_NOTIFICATION_TYPE_ERROR))),
  template: z.optional(z.string().min(5).max(32_000)),
  bearer: z.optional(z.string().min(1).max(1_000)),
  limit: z.optional(z.number().min(0).max(Number.MAX_SAFE_INTEGER)),
});

const $LogNotification = z.object({
  type: z.literal('log'),
});

const $WebsocketNotification = z.object({
  type: z.literal('websocket'),
});

function distinct(a: Array<string>) {
  return Array.from(new Set(a));
}

export const $Subscription = z
  .object({
    id: $SafeId,
    origin: z
      .string({
        required_error: 'origin id is required',
      })
      .min(1),
    senders: z.optional(
      z.literal('*').or(z.array(z.string()).min(1, 'at least 1 sender address is required').transform(distinct))
    ),
    destinations: z
      .array(
        z
          .string({
            required_error: 'destination id is required',
          })
          .min(1)
      )
      .transform(distinct),
    ephemeral: z.optional(z.boolean()),
    channels: z
      .array(z.discriminatedUnion('type', [$WebhookNotification, $LogNotification, $WebsocketNotification]))
      .min(1),
    // prevent using $refs
    events: z.optional(
      z.literal('*').or(z.array(z.nativeEnum(XcmNotificationType)).min(1, XCM_NOTIFICATION_TYPE_ERROR))
    ),
  })
  .refine(
    (schema) => !schema.ephemeral || (schema.channels.length === 1 && schema.channels[0].type === 'websocket'),
    'ephemeral subscriptions only supports websocket notifications'
  );

export type WebhookNotification = z.infer<typeof $WebhookNotification>;

export type Subscription = z.infer<typeof $Subscription>;

export type XcmEventListener = (sub: Subscription, xcm: XcmNotifyMessage) => void;

export type RxSubscriptionWithId = {
  chainId: string;
  sub: RxSubscription;
};

export type RxSubscriptionHandler = {
  originSubs: RxSubscriptionWithId[];
  destinationSubs: RxSubscriptionWithId[];
  sendersControl: ControlQuery;
  messageControl: ControlQuery;
  descriptor: Subscription;
  relaySub?: RxSubscriptionWithId;
};

export type SubscriptionStats = {
  persistent: number;
  ephemeral: number;
};

export type BinBlock = {
  block: Uint8Array;
  events: Uint8Array[];
  author?: Uint8Array;
};

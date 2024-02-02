import z from 'zod';

import { Subscription, Observable } from 'rxjs';

import type { AnyJson } from '@polkadot/types-codec/types';
import type { Vec, Bytes } from '@polkadot/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';

import { ControlQuery } from '@sodazone/ocelloids';

export const $ChainHead = z.object({
  chainId: z.string().min(1),
  blockNumber: z.string().min(1),
  blockHash: z.string().min(1),
  parentHash: z.string().min(1),
  receivedAt: z.date()
});

export type ChainHead = z.infer<typeof $ChainHead>;

export const $SafeId = z.string({
  required_error: 'id is required'
}).min(1).max(1024).regex(/[A-Za-z0-9:\.\-_]+/);

export type HexString = `0x${string}`;

function toHexString(buf: Uint8Array) : HexString {
  return `0x${Buffer.from(buf).toString('hex')}`;
}

export type XcmCriteria = {
  sendersControl: ControlQuery,
  messageControl: ControlQuery
}

export type XcmWithContext = {
  event: AnyJson,
  extrinsicId?: string,
  blockNumber: string | number,
  blockHash: HexString,
  messageHash: HexString,
  messageId?: HexString
}

export interface XcmSentWithContext extends XcmWithContext {
  messageData: Uint8Array,
  recipient: string,
  sender: AnyJson,
  instructions: AnyJson,
}

export interface XcmReceivedWithContext extends XcmWithContext {
  outcome: 'Success' | 'Fail',
  error: AnyJson
}

export class GenericXcmReceivedWithContext implements XcmReceivedWithContext {
  event: AnyJson;
  extrinsicId?: string | undefined;
  blockNumber: string;
  blockHash: HexString;
  messageHash: HexString;
  messageId: HexString;
  outcome: 'Success' | 'Fail';
  error: AnyJson;

  constructor(msg: XcmReceivedWithContext) {
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId ?? msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
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
      error: this.error
    };
  }
}

export class XcmReceived {
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

  constructor(
    subscriptionId: string,
    chainId: string,
    msg: XcmReceivedWithContext
  ) {
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
  }
}

export class GenericXcmSentWithContext implements XcmSentWithContext {
  messageData: Uint8Array;
  recipient: string;
  instructions: AnyJson;
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
      instructions: this.instructions,
      messageHash: this.messageHash,
      event: this.event,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      extrinsicId: this.extrinsicId,
      messageId: this.messageId,
      sender: this.sender
    };
  }
}

export class XcmSent {
  subscriptionId: string;
  chainId: string;
  messageData: string;
  recipient: string;
  instructions: AnyJson;
  messageHash: HexString;
  event: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  sender: AnyJson;
  messageId?: HexString;
  extrinsicId?: string;

  constructor(
    subscriptionId: string,
    chainId: string,
    msg: XcmSentWithContext
  ) {
    this.chainId = chainId;
    this.subscriptionId = subscriptionId;
    this.event = msg.event;
    this.messageData = toHexString(msg.messageData);
    this.recipient = msg.recipient;
    this.instructions = msg.instructions;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber.toString();
    this.extrinsicId = msg.extrinsicId;
    this.sender = msg.sender;
  }
}

type XcmMatchedContext = {
  chainId: string,
  blockNumber: string,
  blockHash: HexString,
  extrinsicId?: string,
  event: AnyJson
}

export class XcmMatched {
  subscriptionId: string;
  origin: XcmMatchedContext;
  destination: XcmMatchedContext;
  messageHash: HexString;
  messageData: string;
  instructions: AnyJson;
  outcome: 'Success' | 'Fail';
  sender: AnyJson;
  error: AnyJson;
  messageId?: HexString;

  constructor(
    outMsg: XcmSent,
    inMsg: XcmReceived
  ) {
    this.subscriptionId = outMsg.subscriptionId;
    this.destination = {
      chainId: inMsg.chainId,
      blockNumber: inMsg.blockNumber,
      blockHash: inMsg.blockHash,
      extrinsicId: inMsg.extrinsicId,
      event: inMsg.event
    };
    this.origin = {
      chainId: outMsg.chainId,
      blockNumber: outMsg.blockNumber,
      blockHash: outMsg.blockHash,
      extrinsicId: outMsg.extrinsicId,
      event: outMsg.event
    };
    this.sender = outMsg.sender;
    this.instructions = outMsg.instructions;
    this.messageData = outMsg.messageData;
    this.messageId = outMsg.messageId;
    this.messageHash = inMsg.messageHash;
    this.outcome = inMsg.outcome;
    this.error = inMsg.error;
  }
}

const $WebhookNotification = z.object({
  type: z.literal('webhook'),
  url: z.string().min(5).max(2_000).regex(/https?:\/\/.*/),
  contentType: z.optional(z.string().regex(
    /(?:application|text)\/[a-z0-9-\+\.]+/i
  ).max(250)),
  template: z.optional(z.string().min(5).max(32_000)),
  bearer: z.optional(z.string().min(1).max(1_000)),
  limit: z.optional(z.number().min(0).max(Number.MAX_SAFE_INTEGER))
});

const $LogNotification = z.object({
  type: z.literal('log'),
});

export const $QuerySubscription = z.object({
  id: $SafeId,
  origin: z.string({
    required_error: 'origin id is required',
  }).min(1),
  senders: z.literal('*').or(z.array(z.string()).min(
    1, 'at least 1 sender address is required'
  )),
  destinations: z.array(z.string({
    required_error: 'destination id is required'
  }).min(1)),
  notify: z.discriminatedUnion('type', [
    $WebhookNotification,
    $LogNotification
  ])
});

export type WebhookNotification = z.infer<typeof $WebhookNotification>;

/**
 * Parameters for a query subscriptions.
 */
export type QuerySubscription = z.infer<typeof $QuerySubscription>;

export type SubscriptionWithId = {
  chainId: string
  sub: Subscription
}

export type SubscriptionHandler = {
  originSubs: SubscriptionWithId[],
  destinationSubs: SubscriptionWithId[],
  sendersControl: ControlQuery,
  messageControl: ControlQuery,
  descriptor: QuerySubscription
}

export type BinBlock = {
  block: Uint8Array;
  events: Uint8Array[];
  author?: Uint8Array;
}

export type GetOutboundHrmpMessages = (hash: `0x${string}`)
=> Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>

export type GetOutboundUmpMessages = (hash: `0x${string}`)
=> Observable<Vec<Bytes>>
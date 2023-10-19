import z from 'zod';

import { Subscription, Observable } from 'rxjs';

import type { AnyJson } from '@polkadot/types-codec/types';
import type { Bytes, Vec } from '@polkadot/types';
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

export type XcmCriteria = {
  sendersControl: ControlQuery,
  messageControl: ControlQuery
}

export type XcmMessageWithContext = {
  event: AnyJson,
  extrinsicId?: string,
  blockNumber: string,
  blockHash: HexString,
  messageHash: HexString,
  messageId?: HexString
}

export interface XcmMessageSentWithContext extends XcmMessageWithContext {
  messageData: Bytes,
  recipient: number,
  instructions: AnyJson,
}

export interface XcmMessageReceivedWithContext extends XcmMessageWithContext {
  outcome: 'Success' | 'Fail',
  error: AnyJson
}

export class GenericXcmMessageReceivedWithContext implements XcmMessageReceivedWithContext {
  event: AnyJson;
  extrinsicId?: string | undefined;
  blockNumber: string;
  blockHash: HexString;
  messageHash: HexString;
  outcome: 'Success' | 'Fail';
  error: AnyJson;

  constructor(msg: XcmMessageReceivedWithContext) {
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber;
    this.extrinsicId = msg.extrinsicId;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      extrinsicId: this.extrinsicId,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      event: this.event,
      outcome: this.outcome,
      error: this.error
    };
  }
}

export class XcmMessageReceived {
  chainId: string | number;
  event: AnyJson;
  messageHash: HexString;
  outcome: 'Success' | 'Fail';
  error: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  extrinsicId?: string;

  constructor(
    chainId: string| number,
    msg: XcmMessageReceivedWithContext
  ) {
    this.chainId = chainId;
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber;
    this.extrinsicId = msg.extrinsicId;
  }
}

export class GenericXcmMessageSentWithContext implements XcmMessageSentWithContext {
  messageData: Bytes;
  recipient: number;
  instructions: AnyJson;
  messageHash: HexString;
  event: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  extrinsicId?: string;

  constructor(msg: XcmMessageSentWithContext) {
    this.event = msg.event;
    this.messageData = msg.messageData;
    this.recipient = msg.recipient;
    this.instructions = msg.instructions;
    this.messageHash = msg.messageHash;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber;
    this.extrinsicId = msg.extrinsicId;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageData: this.messageData.toHex(),
      recipient: this.recipient,
      instructions: this.instructions,
      messageHash: this.messageHash,
      event: this.event,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      extrinsicId: this.extrinsicId
    };
  }
}

export class XcmMessageSent {
  subscriptionId: string;
  chainId: string | number;
  messageData: string;
  recipient: number;
  instructions: AnyJson;
  messageHash: HexString;
  event: AnyJson;
  blockHash: HexString;
  blockNumber: string;
  messageId?: HexString;
  extrinsicId?: string;

  constructor(
    subscriptionId: string,
    chainId: string| number,
    msg: XcmMessageSentWithContext
  ) {
    this.chainId = chainId;
    this.subscriptionId = subscriptionId;
    this.event = msg.event;
    this.messageData = msg.messageData.toHex();
    this.recipient = msg.recipient;
    this.instructions = msg.instructions;
    this.messageHash = msg.messageHash;
    this.messageId = msg.messageId;
    this.blockHash = msg.blockHash;
    this.blockNumber = msg.blockNumber;
    this.extrinsicId = msg.extrinsicId;
  }
}

type XcmMessageNofityContext = {
  chainId: string | number,
  blockNumber: string,
  blockHash: HexString,
  extrinsicId?: string,
  event: AnyJson
}

export class XcmMessageNotify {
  subscriptionId: string;
  origin: XcmMessageNofityContext;
  destination: XcmMessageNofityContext;
  messageHash: HexString;
  messageData: string;
  instructions: AnyJson;
  outcome: 'Success' | 'Fail';
  error: AnyJson;

  constructor(
    outMsg: XcmMessageSent,
    inMsg: XcmMessageReceived
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
    this.instructions = outMsg.instructions;
    this.messageData = outMsg.messageData;
    this.messageHash = inMsg.messageHash;
    this.outcome = inMsg.outcome;
    this.error = inMsg.error;
  }
}

const $WebhookNotification = z.object({
  type: z.literal('webhook'),
  url: z.string().min(5).regex(/https?:\/\/.*/)
});

const $LogNotification = z.object({
  type: z.literal('log'),
});

export const $QuerySubscription = z.object({
  id: $SafeId,
  origin: z.number({
    required_error: 'origin id is required',
  }).min(0),
  senders: z.array(z.string()).min(
    1, 'at least 1 sender address is required'
  ),
  destinations: z.array(z.number({
    required_error: 'destination id is required'
  }).min(0)),
  notify: z.union([
    $WebhookNotification,
    $LogNotification
  ])
});

/**
 * Parameters for a query subscriptions.
 */
export type QuerySubscription = z.infer<typeof $QuerySubscription>;

export type SubscriptionHandler = {
  originSubs: Subscription[],
  destinationSubs: Subscription[],
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
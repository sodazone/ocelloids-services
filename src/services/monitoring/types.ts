import z from 'zod';
import type { AnyJson } from '@polkadot/types-codec/types';
import type { Bytes } from '@polkadot/types';

import { types, ControlQuery } from '@sodazone/ocelloids';

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

export type XcmCriteria = {
  sendersControl: ControlQuery,
  messageControl: ControlQuery
}

export type XcmMessageWithContext = {
  event: types.EventWithIdAndTx,
  messageHash: string,
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
  event: types.EventWithIdAndTx;
  messageHash: string;
  outcome: 'Success' | 'Fail';
  error: AnyJson;

  constructor(msg: XcmMessageReceivedWithContext) {
    this.event = msg.event;
    this.messageHash = msg.messageHash;
    this.outcome = msg.outcome;
    this.error = msg.error;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      event: this.event.toHuman(),
      outcome: this.outcome,
      error: this.error
    };
  }
}

export class XcmMessageReceivedEvent extends GenericXcmMessageReceivedWithContext {
  chainId: string | number;

  constructor(chainId: string| number, msg: XcmMessageReceivedWithContext) {
    super(msg);
    this.chainId = chainId;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    const data = super.toHuman();
    return {
      ...data,
      chainId: this.chainId.toString()
    };
  }
}

export class GenericXcmMessageSentWithContext implements XcmMessageSentWithContext {
  messageData: Bytes;
  recipient: number;
  instructions: AnyJson;
  messageHash: string;
  event: types.EventWithIdAndTx;

  constructor(msg: XcmMessageSentWithContext) {
    this.event = msg.event;
    this.messageData = msg.messageData;
    this.recipient = msg.recipient;
    this.instructions = msg.instructions;
    this.messageHash = msg.messageHash;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageData: this.messageData.toHex(),
      recipient: this.recipient,
      instructions: this.instructions,
      messageHash: this.messageHash,
      event: this.event.toHuman()
    };
  }
}

export class XcmMessageSentEvent extends GenericXcmMessageSentWithContext {
  chainId: string | number;

  constructor(chainId: string| number, msg: XcmMessageSentWithContext) {
    super(msg);
    this.chainId = chainId;
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    const data = super.toHuman();
    return {
      ...data,
      chainId: this.chainId.toString()
    };
  }
}

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
  // TODO union...
  notify: z.object({
    endpoint: z.string()
  })
});

/**
 * Parameters for a query subscriptions.
 */
export type QuerySubscription = z.infer<typeof $QuerySubscription>;

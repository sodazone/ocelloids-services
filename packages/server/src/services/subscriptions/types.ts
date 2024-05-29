import z from 'zod'

import { Subscription as RxSubscription } from 'rxjs'

import { $AgentId } from '../agents/types.js'
import { NotifyMessage } from '../notification/types.js'

/**
 * Represents a generic JSON object.
 *
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
      [index: string]: AnyJson
    }

export const $ChainHead = z.object({
  chainId: z.string().min(1),
  blockNumber: z.string().min(1),
  blockHash: z.string().min(1),
  parentHash: z.string().min(1),
  receivedAt: z.date(),
})

export type ChainHead = z.infer<typeof $ChainHead>

export type BlockNumberRange = {
  fromBlockNum: string
  toBlockNum: string
}

// "urn:ocn:agent-id:subscription-id"
export const $SafeId = z
  .string({
    required_error: 'id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9:.\-_]+/)

/**
 * A hex string starting with '0x'.
 *
 * @public
 */
export type HexString = `0x${string}`

export function toHexString(buf: Uint8Array): HexString {
  return `0x${Buffer.from(buf).toString('hex')}`
}

/**
 * Account data of the signer of an XCM.
 *
 * Includes any extra signers involved e.g. proxy accounts, multisigs
 *
 * @public
 */
export type SignerData = {
  signer: {
    id: AnyJson
    publicKey: HexString
  }
  extraSigners: {
    type: string
    id: AnyJson
    publicKey: HexString
  }[]
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
  template: z.optional(z.string().min(5).max(32_000)),
  bearer: z.optional(z.string().min(1).max(1_000)),
  limit: z.optional(z.number().min(0).max(Number.MAX_SAFE_INTEGER)),
})

const $LogNotification = z.object({
  type: z.literal('log'),
})

const $WebsocketNotification = z.object({
  type: z.literal('websocket'),
})

export const $AgentArgs = z.record(
  z.string({
    required_error: 'argument name is required',
  }),
  z.any()
)

export const $Subscription = z
  .object({
    id: $SafeId,
    agent: $AgentId,
    args: $AgentArgs,
    ephemeral: z.optional(z.boolean()),
    channels: z
      .array(z.discriminatedUnion('type', [$WebhookNotification, $LogNotification, $WebsocketNotification]))
      .min(1),
  })
  .refine(
    (schema) =>
      !schema.ephemeral ||
      (schema.channels !== undefined && schema.channels.length === 1 && schema.channels[0].type === 'websocket'),
    'ephemeral subscriptions only supports websocket notifications'
  )

export type WebhookNotification = z.infer<typeof $WebhookNotification>

export type Subscription = z.infer<typeof $Subscription>

export type NotificationListener = (sub: Subscription, msg: NotifyMessage) => void

export type RxSubscriptionWithId = {
  chainId: string
  sub: RxSubscription
}

export type SubscriptionStats = {
  persistent: number
  ephemeral: number
}

export type BinBlock = {
  block: Uint8Array
  events: Uint8Array[]
  author?: Uint8Array
}

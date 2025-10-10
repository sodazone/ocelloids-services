import z from 'zod'

import { Subscription as RxSubscription } from 'rxjs'

import { $AgentId } from '../agents/types.js'
import { Message } from '../egress/types.js'
import { AnyJson } from '../types.js'

export const $ChainHead = z.object({
  chainId: z.string().min(1),
  blockNumber: z.string().min(1),
  blockHash: z.string().min(1),
  parentHash: z.string().min(1),
  receivedAt: z.date(),
})

export type ChainHead = z.infer<typeof $ChainHead>

export type BlockNumberRange = {
  fromBlockNum: number
  toBlockNum: number
}

/**
 * Schema to validate subscription IDs.
 */
export const $SubscriptionId = z
  .string({
    required_error: 'subscription id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9.\-_]+/)

/**
 * Subscription identifier.
 *
 * @public
 */
export type SubscriptionId = z.infer<typeof $SubscriptionId>

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
      .max(250),
  ),
  events: z.optional(z.array(z.string()).or(z.literal('*'))),
  template: z.optional(z.string().min(5).max(32_000)),
  bearer: z.optional(z.string().min(1).max(1_000)),
  secret: z.optional(z.string().min(1).max(1_000)),
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
  z.any(),
)

export const $Subscription = z.object({
  id: $SubscriptionId,
  agent: $AgentId,
  args: $AgentArgs,
  owner: z.string(),
  public: z.optional(z.boolean()),
  ephemeral: z.optional(z.boolean()),
  channels: z
    .array(z.discriminatedUnion('type', [$WebhookNotification, $LogNotification, $WebsocketNotification]))
    .min(1),
})

export const $NewSubscription = $Subscription.omit({ owner: true })

export type WebhookNotification = z.infer<typeof $WebhookNotification>

export type Subscription<T = Record<string, any>> = Omit<z.infer<typeof $Subscription>, 'args'> & { args: T }

export type NewSubscription<T = Record<string, any>> = Omit<z.infer<typeof $NewSubscription>, 'args'> & {
  args: T
}

export type EgressMessageListener = (sub: Subscription, msg: Message) => void
export type EgressTerminateListener = (sub: Subscription) => void

export type RxSubscriptionWithId = {
  id: string
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

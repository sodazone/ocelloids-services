import { Subscription as RxSubscription } from 'rxjs'
import { z } from 'zod'

import { ControlQuery } from '@/common/index.js'
import { $HistoricalQuery } from '@/services/archive/types.js'
import { RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { XcmNotificationTypes } from './messages.js'

function distinct(a: Array<string>) {
  return Array.from(new Set(a))
}

export type Monitor = {
  streams: RxSubscriptionWithId[]
  controls: Record<string, ControlQuery>
}

export type XcmSubscriptionHandler = {
  sendersControl: ControlQuery
  destinationsControl: ControlQuery
  originsControl: ControlQuery
  notificationTypeControl: ControlQuery
  subscription: Subscription<XcmInputs>
  stream: RxSubscription
}

const bridgeTypes = ['pk-bridge', 'snowbridge'] as const

export type BridgeType = (typeof bridgeTypes)[number]

export type RxBridgeSubscription = { type: BridgeType; subs: RxSubscriptionWithId[] }

const XCM_NOTIFICATION_TYPE_ERROR = `at least 1 event type is required [${XcmNotificationTypes.join(',')}]`

export const $XcmInputs = z.object({
  origins: z.literal('*').or(
    z
      .array(
        z
          .string({
            required_error: 'at least 1 origin is required',
          })
          .min(1),
      )
      .transform(distinct),
  ),
  senders: z.optional(
    z
      .literal('*')
      .or(z.array(z.string()).min(1, 'at least 1 sender address is required').transform(distinct)),
  ),
  destinations: z.literal('*').or(
    z
      .array(
        z
          .string({
            required_error: 'at least 1 destination is required',
          })
          .min(1),
      )
      .transform(distinct),
  ),
  bridges: z.optional(z.array(z.enum(bridgeTypes)).min(1, 'Please specify at least one bridge.')),
  // prevent using $refs
  events: z.optional(
    z.literal('*').or(z.array(z.enum(XcmNotificationTypes)).min(1, XCM_NOTIFICATION_TYPE_ERROR)),
  ),
  history: z.optional($HistoricalQuery),
})

export type XcmInputs = z.infer<typeof $XcmInputs>

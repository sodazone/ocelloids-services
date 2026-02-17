import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'
import { ControlQuery } from '@/common/index.js'
import { $NetworkString } from '@/common/types.js'
import { uniqueArray } from '@/common/util.js'
import { Subscription } from '@/services/subscriptions/types.js'

export type CrosschainSubscriptionHandler = {
  networksControl: ControlQuery
  subscription: Subscription<CrosschainSubscriptionInputs>
  stream: RxSubscription
}

export const $CrosschainSubscriptionInputs = z.object({
  networks: z.literal('*').or(z.array($NetworkString).transform(uniqueArray)),
})

export type CrosschainSubscriptionInputs = z.infer<typeof $CrosschainSubscriptionInputs>

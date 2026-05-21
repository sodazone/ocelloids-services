import { AnySubscriptionInputs } from '../types'

/**
 * Guard condition for {@link AnySubscriptionInputs}.
 *
 * Only to discriminate between subscription id and input.
 *
 * @internal
 */
export function isSubscriptionInputs<T = AnySubscriptionInputs>(object: any): object is T {
  return typeof object === 'object'
}

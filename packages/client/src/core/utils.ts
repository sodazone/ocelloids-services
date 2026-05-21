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

export function isGreaterThan(a: string | number, b: string | number): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a > b
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) > Number(b)
  }
  return a.localeCompare(b) > 0
}

export function isGreaterThanOrEqual(a: string | number, b: string | number): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a >= b
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) >= Number(b)
  }
  return String(a).localeCompare(String(b)) >= 0
}

export function isLessThanOrEqual(a: string | number, b: string | number): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a <= b
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) <= Number(b)
  }
  return a.localeCompare(b) <= 0
}

import { filter } from 'rxjs'

/**
 * Guard for NonNullable<T>.
 *
 * Checks if a value is not null or undefined.
 */
export function isNonNull<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

/**
 * Filters null and undefined values from a observable,
 * using a NonNullable guard condition.
 *
 * @returns a filter operator with the isNonNull guard.
 */
export function filterNonNull() {
  return filter(isNonNull)
}

import { Timeframe } from './types.js'

type RelativeTimeframe = {
  rel: 'this' | 'previous'
  n: number
  units: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
}

export const RELATIVE_TIMEFRAME_REGEX = /^(this|previous)_(\d+)_(minutes|hours|days|weeks|months|years)$/
export const PERIOD_REGEX = /^(\d+)_(minutes|hours|days|weeks|months|years)$/

const MUL: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 24 * 3_600_000,
  weeks: 7 * 24 * 3_600_000,
  months: 30 * 24 * 3_600_000,
  years: 365 * 24 * 3_600_000,
}

/**
 * Converts a period string (e.g., "5_days", "3_hours") into milliseconds.
 *
 * The input period should match the regex pattern `/^(\d+)_(minutes|hours|days|weeks|months|years)$/`,
 * which expects a number followed by an underscore and a valid unit (minutes, hours, days, weeks, months, years).
 *
 * The optional `from` parameter allows specifying a starting timestamp from which the period is subtracted.
 * If not provided, `Date.now()` is used by default.
 *
 * @param input - A string representing the period. It should contain a number followed by an underscore
 *                and a valid unit (e.g., "5_days", "3_hours").
 *                Example: "3_days" for 3 days, "5_hours" for 5 hours.
 * @param from - (Optional) The starting timestamp to subtract the period from. Defaults to the current timestamp
 *               (`Date.now()`).
 *
 * @returns The resulting timestamp in milliseconds after subtracting the period from `from`.
 *
 * @throws {Error} If the `input` string does not match the expected format or if an invalid period expression is provided.
 *
 * @example
 * // Convert a period of 5 days into milliseconds from now
 * const millis = periodToMillis("5_days");
 * console.log(millis); // Logs the current timestamp minus 5 days in milliseconds
 */
export function periodToMillis(input: string, from?: number) {
  const match = input.match(PERIOD_REGEX)

  if (!match) {
    throw new Error(`invalid period expression: ${input}`)
  }

  const [, nStr, units] = match
  const n = parseInt(nStr, 10)

  return (from ?? Date.now()) - Number(n) * MUL[units]
}

/**
 * Parses a relative timeframe string and returns its structured representation.
 *
 * The input string must follow the pattern `{rel}_{n}_{units}`.
 *
 * ## Components:
 * - `{rel}`: Either "this" or "previous"
 *   - "this": Includes events happening up until now.
 *   - "previous": Includes only complete time chunks (e.g., full hour, day, week).
 * - `{n}`: A whole number greater than 0.
 * - `{units}`: One of "minutes", "hours", "days", "weeks", "months", or "years".
 *
 * @param {string} input - The relative timeframe string to parse.
 * @returns {RelativeTimeframe} The parsed relative timeframe object.
 * @throws {Error} If the input string does not match the expected pattern.
 */
export function parseRelativeTimeframe(input: string): RelativeTimeframe {
  const match = input.match(RELATIVE_TIMEFRAME_REGEX)

  if (!match) {
    throw new Error(`invalid relative timeframe expression: ${input}`)
  }

  const [, rel, nStr, units] = match
  const n = parseInt(nStr, 10)

  return { rel: rel as 'this' | 'previous', n, units: units as RelativeTimeframe['units'] }
}

export function toAbsoluteTimeframe(timeframe: string): Timeframe {
  const { rel, n, units } = parseRelativeTimeframe(timeframe)

  if (rel === 'this') {
    const end = Date.now()
    return {
      start: end - Number(n) * MUL[units],
    }
  }

  if (rel === 'previous') {
    const end = Date.now() - MUL[units]
    return {
      end,
      start: end - Number(n) * MUL[units],
    }
  }

  throw new Error(`unknown relative timeframe expression: ${timeframe}`)
}

export function asUTC(strTimestamp: string) {
  return new Date(strTimestamp + 'Z').getTime()
}

function p(n: number, max = 2) {
  return n.toString().padStart(max, '0')
}

export function toUTCMillis(date: Date | string | number) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.getTime()
}

export function toUTCString(date: Date | string | number) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`
}

export function asDateRange(timeframe: Partial<Timeframe> | string) {
  if (typeof timeframe === 'string') {
    return toAbsoluteTimeframe(timeframe)
  } else {
    return timeframe
  }
}

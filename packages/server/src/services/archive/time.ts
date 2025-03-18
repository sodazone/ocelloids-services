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

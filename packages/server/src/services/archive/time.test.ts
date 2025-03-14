import { parseRelativeTimeframe, toAbsoluteTimeframe } from './time.js'

describe('time fns', () => {
  it('should parse a relative time frame from this', () => {
    const rel = parseRelativeTimeframe('this_7_hours')
    expect(rel).toBeDefined()
    expect(rel.units).toBe('hours')
    expect(rel.rel).toBe('this')
    expect(rel.n).toBe(7)
  })

  it('should parse a relative time frame from previous', () => {
    const rel = parseRelativeTimeframe('previous_70_days')
    expect(rel).toBeDefined()
    expect(rel.units).toBe('days')
    expect(rel.rel).toBe('previous')
    expect(rel.n).toBe(70)
  })

  it('should throw on malformed expression', () => {
    expect(() => parseRelativeTimeframe('previos_70_days')).toThrowError()
  })

  it('should convert a relative time frame from previous', () => {
    const { start, end } = toAbsoluteTimeframe('previous_5_hours')
    const now = Date.now()
    expect(start).toBeLessThanOrEqual(now - 5 * 60 * 60_000)
    expect(end).toBeLessThanOrEqual(now - 60 * 60_000)
  })

  it('should convert a relative time frame from this', () => {
    const { start, end } = toAbsoluteTimeframe('this_2_days')
    const now = Date.now()
    expect(start).toBeLessThanOrEqual(now - 2 * 24 * 60 * 60_000)
    expect(end).toBeUndefined()
  })
})

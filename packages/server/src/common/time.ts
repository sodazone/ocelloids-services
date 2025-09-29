export const ms = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000, // rough
  year: 365 * 24 * 60 * 60 * 1000, // rough
}

export function ago(amount: number, unit: keyof typeof ms): string {
  return new Date(Date.now() - amount * ms[unit]).toISOString()
}

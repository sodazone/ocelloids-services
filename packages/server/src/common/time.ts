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

export function humanizeTime(date: Date): string {
  const target = date.getTime()
  const now = Date.now()
  const diff = target - now
  const abs = Math.abs(diff)

  const units = [
    ['year', ms.year],
    ['month', ms.month],
    ['week', ms.week],
    ['day', ms.day],
    ['hour', ms.hour],
    ['minute', ms.minute],
    ['second', ms.second],
  ] as const

  for (const [name, size] of units) {
    if (abs >= size) {
      const value = Math.floor(abs / size)
      const plural = value === 1 ? '' : 's'
      return diff >= 0 ? `in ${value} ${name}${plural}` : `${value} ${name}${plural} ago`
    }
  }

  return 'just now'
}

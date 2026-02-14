export function encodeCursor<T extends { sent_at: number; id: number }>(items: T[]): string {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    const { sent_at, id } = item

    if (sent_at !== undefined && sent_at !== null) {
      const timestamp = typeof sent_at === 'number' ? sent_at : (sent_at as Date).getTime()

      return Buffer.from(`${timestamp}|${id}`).toString('base64')
    }
  }

  throw new Error('No sent_at timestamp found in journeys list')
}

export function decodeCursor(cursor: string): { timestamp: number; id: number } {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const [timestampStr, idStr] = decoded.split('|')
    const timestamp = parseInt(timestampStr, 10)
    const id = parseInt(idStr, 10)
    if (isNaN(timestamp) || isNaN(id)) {
      throw new Error()
    }
    return { timestamp, id }
  } catch {
    throw new Error('Invalid cursor format')
  }
}

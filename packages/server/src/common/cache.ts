type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export function createCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>()

  return {
    get(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) {
        return undefined
      }

      if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return undefined
      }

      return entry.value
    },

    set(key: string, value: T): void {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      })
    },

    delete(key: string): void {
      store.delete(key)
    },

    clear(): void {
      store.clear()
    },
  }
}

export type SimpleCache<T> = ReturnType<typeof createCache<T>>

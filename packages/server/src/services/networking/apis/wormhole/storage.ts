import { Level } from 'level'
import { Cursor, PendingEntry } from './watcher.js'

const jsonEncoded = { valueEncoding: 'json' }

export type PersistentWatcherStorage = {
  saveCursor: (key: string, cursor: Cursor) => Promise<void>
  loadCursor: (key: string) => Promise<Cursor | undefined>
  savePendingOp: (opId: string, entry: PendingEntry) => Promise<void>
  deletePendingOp: (opId: string) => Promise<void>
  loadPendingOps: () => Promise<Record<string, PendingEntry>>
}

export function makeLevelStorage(levelDB: Level): PersistentWatcherStorage {
  const cursorSub = levelDB.sublevel<string, Cursor>('wh:cursor', jsonEncoded)
  const pendingSub = levelDB.sublevel<string, PendingEntry>('wh:pending', jsonEncoded)

  return {
    async saveCursor(key: string, cursor: Cursor) {
      await cursorSub.put(key, cursor)
    },

    async loadCursor(key: string): Promise<Cursor | undefined> {
      try {
        return await cursorSub.get(key)
      } catch {
        return
      }
    },

    async savePendingOp(opId: string, entry: PendingEntry) {
      await pendingSub.put(opId, entry)
    },

    async deletePendingOp(opId: string) {
      try {
        await pendingSub.del(opId)
      } catch {
        //
      }
    },

    async loadPendingOps(): Promise<Record<string, PendingEntry>> {
      const result: Record<string, PendingEntry> = {}
      for await (const [id, entry] of pendingSub.iterator()) {
        result[id] = entry
      }
      return result
    },
  }
}

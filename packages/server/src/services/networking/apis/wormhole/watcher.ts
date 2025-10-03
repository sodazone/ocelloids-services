import pLimit from 'p-limit'
import { Observable } from 'rxjs'

import { JourneyStatus } from '@/services/agents/crosschain/index.js'
import { WormholescanClient } from './client.js'
import { toStatus } from './status.js'
import { PersistentWatcherStorage } from './storage.js'
import { WormholeOperation } from './types.js'

const FINAL_STATUS: JourneyStatus[] = ['received', 'timeout', 'failed', 'unknown']
const MAX_SEEN = 1_000
const CONCURRENCY = 5

const limit = pLimit(CONCURRENCY)

export type Cursor = {
  chain: string
  direction: 'source' | 'destination'
  lastSeen: string
  seenIds?: string[]
}

export type WatcherState = {
  cursors: Record<string, Cursor>
}

export type PendingEntry = {
  op: WormholeOperation
  status: JourneyStatus
  firstSeen: number
}

function rememberSeen(cursor: Cursor, ids: string[]): Cursor {
  const merged = [...(cursor.seenIds ?? []), ...ids]
  return { ...cursor, seenIds: merged.slice(-MAX_SEEN) }
}

function isSeen(cursor: Cursor, id: string): boolean {
  return cursor.seenIds?.includes(id) ?? false
}

function bumpTimestamp(ts: string): string {
  return new Date(new Date(ts).getTime() + 1).toISOString()
}

export function makeWatcher(client: WormholescanClient, storage?: PersistentWatcherStorage) {
  async function fetchSinceCursor(cursor: Cursor): Promise<[Cursor, WormholeOperation[]]> {
    const ops = await client.fetchAllOperations({
      from: cursor.lastSeen,
      ...(cursor.direction === 'source' ? { sourceChain: cursor.chain } : { targetChain: cursor.chain }),
    })

    const freshOps = ops.filter((op) => !isSeen(cursor, op.id))
    if (freshOps.length === 0) {
      return [cursor, []]
    }

    const maxTs = freshOps.reduce(
      (acc, o) => (o.sourceChain.timestamp > acc ? o.sourceChain.timestamp : acc),
      cursor.lastSeen,
    )

    const nextCursor = rememberSeen(
      { ...cursor, lastSeen: bumpTimestamp(maxTs) },
      freshOps.map((o) => o.id),
    )

    return [nextCursor, freshOps]
  }

  async function fetchBatch(state: WatcherState): Promise<[WatcherState, WormholeOperation[]]> {
    const results: WormholeOperation[] = []
    const newCursors: Record<string, Cursor> = {}

    for (const [key, cursor] of Object.entries(state.cursors)) {
      const [nextCursor, ops] = await fetchSinceCursor(cursor)
      newCursors[key] = nextCursor
      results.push(...ops)

      if (storage) {
        await storage.saveCursor(key, nextCursor)
      }
    }

    return [{ cursors: newCursors }, results]
  }

  async function loadInitialState(chains: string[] | number[], cutDate: string): Promise<WatcherState> {
    const cursors: Record<string, Cursor> = {}

    for (const c of chains) {
      for (const dir of ['source', 'destination'] as const) {
        const key = `${c}.${dir}`
        let cursor = storage ? await storage.loadCursor(key) : undefined
        if (!cursor) {
          cursor = { chain: String(c), direction: dir, lastSeen: cutDate, seenIds: [] }
        }
        cursors[key] = cursor
      }
    }

    return { cursors }
  }

  function operations$(
    initialState: WatcherState,
    intervalMs = 10_000, // 10s
    timeoutMs = 24 * 60 * 60 * 1_000, // 24h
  ): Observable<{ op: WormholeOperation; status: JourneyStatus }> {
    return new Observable((subscriber) => {
      let state = initialState
      let active = true
      const pending = new Map<string, PendingEntry>()

      // restore pending ops before starting loop
      ;(async () => {
        if (storage) {
          const stored = await storage.loadPendingOps()
          for (const [id, entry] of Object.entries(stored)) {
            pending.set(id, entry)
          }
        }
      })().then(() => loop())

      const loop = async () => {
        while (active) {
          const now = Date.now()

          try {
            // 1. fetch new ops
            const [nextState, newOps] = await fetchBatch(state)
            state = nextState
            processOps(newOps, now)

            // 2. fetch pending ops
            const pendingUpdates = await Promise.all(
              Array.from(pending.entries()).map(([id, entry]) =>
                limit(async () => {
                  try {
                    const updatedOp = await client.fetchOperationById(id)
                    const newStatus = toStatus(updatedOp) as JourneyStatus
                    return { id, updatedOp, newStatus, entry }
                  } catch (err) {
                    console.error('Failed to fetch pending op', id, err)
                    return null
                  }
                }),
              ),
            )

            for (const upd of pendingUpdates) {
              if (upd) {
                processPendingUpdate(upd)
              }
            }

            // 3. handle timeout
            for (const [id, entry] of Array.from(pending.entries())) {
              if (now - entry.firstSeen > timeoutMs) {
                handleTimeout(id, entry)
              }
            }
          } catch (err) {
            subscriber.error(err)
            return
          }

          await new Promise((r) => setTimeout(r, intervalMs))
        }
      }

      async function processOps(ops: WormholeOperation[], now: number) {
        for (const op of ops) {
          const id = op.id
          const status = toStatus(op) as JourneyStatus
          const entry = pending.get(id)

          if (!FINAL_STATUS.includes(status)) {
            // only track non-final ops
            if (!entry) {
              const newEntry: PendingEntry = { op, status, firstSeen: now }
              pending.set(id, newEntry)
              subscriber.next({ op, status })
              if (storage) {
                await storage.savePendingOp(id, newEntry)
              }
            } else if (entry.status !== status) {
              const updatedEntry: PendingEntry = { ...entry, status, op }
              pending.set(id, updatedEntry)
              subscriber.next({ op, status })
              if (storage) {
                await storage.savePendingOp(id, updatedEntry)
              }
            }
          } else {
            // final ops: emit immediately
            if (entry) {
              removePending(id)
            }
            subscriber.next({ op, status })
          }
        }
      }

      function processPendingUpdate({
        id,
        updatedOp,
        newStatus,
        entry,
      }: { id: string; updatedOp: WormholeOperation; newStatus: JourneyStatus; entry: PendingEntry }) {
        if (entry.status !== newStatus) {
          const updatedEntry = { ...entry, status: newStatus, op: updatedOp }
          pending.set(id, updatedEntry)
          subscriber.next({ op: updatedOp, status: newStatus })
          if (storage) {
            storage.savePendingOp(id, updatedEntry)
          }
          if (FINAL_STATUS.includes(newStatus)) {
            removePending(id)
          }
        }
      }

      function handleTimeout(id: string, entry: PendingEntry) {
        subscriber.next({ op: entry.op, status: 'timeout' })
        removePending(id)
      }

      function removePending(id: string) {
        pending.delete(id)
        if (storage) {
          storage.deletePendingOp(id)
        }
      }

      return () => {
        active = false
      }
    })
  }

  return { operations$, loadInitialState }
}

export type WormholeWatcher = ReturnType<typeof makeWatcher>

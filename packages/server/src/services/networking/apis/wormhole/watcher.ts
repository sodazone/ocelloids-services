import pLimit from 'p-limit'
import { Observable } from 'rxjs'
import { immediate } from '@/common/event.loop.js'
import { JourneyStatus } from '@/services/agents/crosschain/index.js'
import { WormholeOperationParams, WormholescanClient } from './client.js'
import { toStatus } from './status.js'
import { PersistentWatcherStorage } from './storage.js'
import { WormholeOperation } from './types.js'

const FINAL_STATUS: JourneyStatus[] = ['received', 'timeout', 'failed', 'unknown']
const MAX_SEEN = 1_000
const CONCURRENCY = 5
const PENDING_THROTTLE_MS = 500
const OPERATION_CACHE_MAX = 2_000

const limit = pLimit(CONCURRENCY)

export type Cursor = {
  chain: string
  direction: 'source' | 'destination'
  lastSeen: string
  seenIds?: string[]
  address?: string
  lastSequence?: number
}

export type WatcherState = {
  cursors: Record<string, Cursor>
}

export type WormholeWatcherConfig = {
  chain: string | number
  address?: string
  mode?: 'operations' | 'vaas'
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

export function makeWatcher(client: WormholescanClient, storage?: PersistentWatcherStorage) {
  const operationCache = new Map<string, WormholeOperation>()

  async function getOrFetchOperation(id: string): Promise<WormholeOperation | undefined> {
    if (operationCache.has(id)) {
      return operationCache.get(id)
    }
    try {
      const op = await client.fetchOperationById(id)
      if (op) {
        if (operationCache.size >= OPERATION_CACHE_MAX) {
          const firstKey = operationCache.keys().next().value
          if (firstKey !== undefined) {
            operationCache.delete(firstKey)
          }
        }
        operationCache.set(id, op)
      }
      return op
    } catch (err) {
      console.error('Failed to fetch operation by ID for VAA', id, err)
      return undefined
    }
  }

  async function fetchSinceCursor(
    cursor: Cursor,
    signal?: AbortSignal | null,
  ): Promise<[Cursor, WormholeOperation[]]> {
    const freshOps: WormholeOperation[] = []
    let maxTs = cursor.lastSeen

    try {
      for await (const op of client.streamAllOperations(
        {
          from: cursor.lastSeen,
          ...(cursor.direction === 'source'
            ? { sourceChain: String(cursor.chain) }
            : { targetChain: String(cursor.chain) }),
          ...(cursor.address ? { address: cursor.address } : {}),
        },
        signal,
      )) {
        if (!isSeen(cursor, op.id)) {
          freshOps.push(op)
          operationCache.set(op.id, op)
        }

        const ts = op.sourceChain?.timestamp

        if (ts && ts > maxTs) {
          maxTs = ts
        }
      }
    } catch (err) {
      console.error('Error streaming ops for', cursor.chain, cursor.direction, cursor.address, err)
      throw err
    }

    if (!freshOps.length) {
      return [cursor, []]
    }

    const nextCursor = rememberSeen(
      { ...cursor, lastSeen: new Date(new Date(maxTs).getTime()).toISOString() },
      freshOps.map((o) => o.id),
    )

    return [nextCursor, freshOps]
  }

  async function fetchVaasSinceCursor(
    cursor: Cursor,
    signal?: AbortSignal | null,
  ): Promise<[Cursor, WormholeOperation[]]> {
    const freshOps: WormholeOperation[] = []
    let maxSeq = cursor.lastSequence ?? -1
    let maxTs = cursor.lastSeen

    if (!cursor.address) {
      return [cursor, []]
    }

    try {
      for await (const vaa of client.streamAllVaas(
        {
          chain: cursor.chain,
          emitter: cursor.address,
        },
        signal,
      )) {
        // Early stop: since VAA results are returned newest-first, hitting an already-seen sequence means we've caught up.
        if (cursor.lastSequence !== undefined && vaa.sequence <= cursor.lastSequence) {
          break
        }

        if (!isSeen(cursor, vaa.id)) {
          const ts = vaa.timestamp
          const cursorTime = new Date(cursor.lastSeen).getTime()
          const vaaTime = ts ? new Date(ts).getTime() : 0

          if (cursor.lastSequence !== undefined || !cursor.lastSeen || !ts || vaaTime >= cursorTime) {
            const op = await getOrFetchOperation(vaa.id)
            if (op) {
              freshOps.push(op)
            }
          }
        }

        if (vaa.sequence > maxSeq) {
          maxSeq = vaa.sequence
        }

        const ts = vaa.timestamp
        if (ts) {
          const currentMaxTime = new Date(maxTs).getTime()
          const tsTime = new Date(ts).getTime()

          if (tsTime > currentMaxTime) {
            maxTs = ts
          }
        }
      }
    } catch (err) {
      console.error('Error streaming vaas for', cursor.chain, cursor.address, err)
      throw err
    }

    if (!freshOps.length && maxSeq <= (cursor.lastSequence ?? -1)) {
      return [cursor, []]
    }

    const nextCursor = rememberSeen(
      {
        ...cursor,
        lastSeen: new Date(new Date(maxTs).getTime()).toISOString(),
        lastSequence: maxSeq > (cursor.lastSequence ?? -1) ? maxSeq : cursor.lastSequence,
      },
      freshOps.map((o) => o.id),
    )

    return [nextCursor, freshOps]
  }

  async function fetchOperationById(id: string): Promise<WormholeOperation | undefined> {
    return await getOrFetchOperation(id)
  }

  async function fetchOperations(
    params: WormholeOperationParams & { page?: number },
    signal?: AbortSignal | null,
  ): Promise<{ operations: WormholeOperation[]; total: number }> {
    return await client.fetchOperations(params, signal)
  }

  async function fetchBatch(
    state: WatcherState,
    signal?: AbortSignal | null,
  ): Promise<[WatcherState, WormholeOperation[]]> {
    const results: WormholeOperation[] = []
    const newCursors: Record<string, Cursor> = {}

    const cursorEntries = Object.entries(state.cursors)

    const tasks = cursorEntries.map(([key, cursor]) =>
      limit(async () => {
        try {
          const isVaas = key.startsWith('vaas.')
          const [nextCursor, ops] = isVaas
            ? await fetchVaasSinceCursor(cursor, signal)
            : await fetchSinceCursor(cursor, signal)

          return { key, nextCursor, ops }
        } catch (err) {
          console.error('Failed fetching cursor', key, err)

          return { key, nextCursor: cursor, ops: [] }
        }
      }),
    )

    const settled = await Promise.all(tasks)

    for (const { key, nextCursor, ops } of settled) {
      newCursors[key] = nextCursor
      results.push(...ops)

      if (storage) {
        try {
          await storage.saveCursor(key, nextCursor)
        } catch (err) {
          console.error('Failed saving cursor', key, err)
        }
      }
    }

    return [{ cursors: newCursors }, results]
  }

  async function loadInitialState(chains: WormholeWatcherConfig[], cutDate: string): Promise<WatcherState> {
    const cursors: Record<string, Cursor> = {}
    for (const item of chains) {
      const chainStr = String(item.chain)
      const address = item.address
      const fetchMode = item.mode ?? 'operations'

      if (fetchMode === 'vaas') {
        if (!address) {
          console.error('VAA fetch mode requires an emitter address for chain', chainStr)
          continue
        }
        const key = `vaas.${chainStr}.${address}`
        let cursor = storage ? await storage.loadCursor(key) : undefined
        if (!cursor) {
          const cutMs = new Date(cutDate).getTime() - 1
          cursor = {
            chain: chainStr,
            direction: 'source',
            lastSeen: new Date(cutMs).toISOString(),
            seenIds: [],
            address,
          }
        }
        cursors[key] = cursor
      } else {
        // operations mode (default)
        for (const dir of ['source', 'destination'] as const) {
          const key = address ? `${chainStr}.${dir}.${address}` : `${chainStr}.${dir}`
          let cursor = storage ? await storage.loadCursor(key) : undefined
          if (!cursor) {
            const cutMs = new Date(cutDate).getTime() - 1
            cursor = {
              chain: chainStr,
              direction: dir,
              lastSeen: new Date(cutMs).toISOString(),
              seenIds: [],
              address,
            }
          }
          cursors[key] = cursor
        }
      }
    }
    return { cursors }
  }

  const pending = new Map<string, PendingEntry>()

  function operations$(
    initialState: WatcherState,
    intervalMs = 20_000, // 20s
    timeoutMs = 2 * 60 * 60 * 1_000, // 2h
  ): Observable<{ op: WormholeOperation; status: JourneyStatus }> {
    return new Observable((subscriber) => {
      let state = initialState
      let active = true
      let loopController: AbortController | null = null

      const loop = async () => {
        while (active) {
          if (loopController) {
            loopController.abort()
          }

          loopController = new AbortController()
          const { signal } = loopController
          const now = Date.now()

          try {
            // 1. fetch new ops
            const [nextState, newOps] = await fetchBatch(state, signal)
            state = nextState
            processOps(newOps, now)

            // 2. fetch pending ops
            for (const [id, entry] of pending.entries()) {
              limit(async () => {
                try {
                  const updatedOp = await client.fetchOperationById(id, signal)
                  const newStatus = toStatus(updatedOp) as JourneyStatus

                  await immediate()

                  processPendingUpdate({
                    id,
                    updatedOp,
                    newStatus,
                    entry,
                  })
                } catch (err) {
                  console.error('Failed to fetch pending op', id, err)
                }
              })

              // Throttle
              await new Promise((r) => setTimeout(r, PENDING_THROTTLE_MS))
            }

            // 3. handle timeout
            for (const [id, entry] of Array.from(pending.entries())) {
              if (now - entry.firstSeen > timeoutMs) {
                handleTimeout(id, entry)
              }
            }
          } catch (err: unknown) {
            if (signal.aborted) {
              break
            }

            if (err instanceof Error) {
              if (err.name === 'AbortError' || (err as any).code === 'ERR_CANCELED') {
                break
              }

              subscriber.error(err)
            } else {
              subscriber.error(new Error(String(err)))
            }

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

          if (FINAL_STATUS.includes(status)) {
            // final ops: emit immediately
            if (entry) {
              removePending(id)
            }
            subscriber.next({ op, status })
          } else if (!entry) {
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
        }
      }

      function processPendingUpdate({
        id,
        updatedOp,
        newStatus,
        entry,
      }: {
        id: string
        updatedOp: WormholeOperation
        newStatus: JourneyStatus
        entry: PendingEntry
      }) {
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
        removePending(id)
      }

      function removePending(id: string) {
        pending.delete(id)
        if (storage) {
          storage.deletePendingOp(id)
        }
      }

      ;(async () => {
        try {
          await client.awaitReady()

          if (storage) {
            try {
              const stored = await storage.loadPendingOps()
              for (const [id, entry] of Object.entries(stored)) {
                pending.set(id, entry)
              }
            } catch (err) {
              console.error('Failed to restore pending ops', err)
            }
          }

          loop()
        } catch (err) {
          subscriber.error(err)
        }
      })()

      return () => {
        active = false
        if (loopController) {
          loopController.abort()
        }
      }
    })
  }

  function isWormholeId(maybeWormholeId: string) {
    return client.isWormholeId(maybeWormholeId)
  }

  return {
    fetchOperationById,
    fetchOperations,
    operations$,
    loadInitialState,
    isWormholeId,
    pendingCount: () => pending.size,
  }
}

export type WormholeWatcher = ReturnType<typeof makeWatcher>

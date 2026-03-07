import path from 'node:path'
import { Level } from 'level'
import { parentPort, workerData } from 'worker_threads'

import { WormholescanClient } from '@/services/networking/apis/wormhole/client.js'
import { makeWormholeLevelStorage } from '@/services/networking/apis/wormhole/storage.js'
import { makeWatcher } from '@/services/networking/apis/wormhole/watcher.js'

const { dataPath } = workerData
const dbPath = path.join(dataPath, 'wh:worker')
const client = new WormholescanClient()
const db = new Level(dbPath)
const storage = makeWormholeLevelStorage(db)
const watcher = makeWatcher(client, storage)

parentPort?.on('message', async (msg) => {
  const { type, payload } = msg

  try {
    switch (type) {
      case 'fetchOperation': {
        const op = await watcher.fetchOperationById(payload.id)
        parentPort?.postMessage({ type: 'fetchOperationResult', result: op, requestId: payload.requestId })
        break
      }

      case 'fetchOperations': {
        const operations = await watcher.fetchOperations(payload.search)
        parentPort?.postMessage({
          type: 'fetchOperationsResult',
          result: operations,
          requestId: payload.requestId,
        })
        break
      }

      case 'startWatcher': {
        const init = await watcher.loadInitialState(payload.chains, payload.since)

        watcher.operations$(init).subscribe({
          next: ({ op }) => {
            parentPort?.postMessage({ type: 'stream', payload: { op } })
          },
          error: (err) => parentPort?.postMessage({ type: 'stream', payload: { error: err.message } }),
        })
        break
      }

      default: {
        parentPort?.postMessage({
          type: 'error',
          error: `Unknown message type: ${type}`,
          requestId: payload.requestId,
        })
      }
    }
  } catch (err) {
    parentPort?.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
      requestId: payload.requestId,
    })
  }
})

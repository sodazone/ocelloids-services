import { MemoryLevel } from 'memory-level'
import { from, Observable } from 'rxjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import Connector from '@/services/networking/connector.js'
import { ChainHead } from '@/services/subscriptions/types.js'
import { jsonEncoded, LevelDB, prefixes, Services } from '@/services/types.js'
import { mockConfigWS } from '@/testing/configs.js'
import { createServices } from '@/testing/services.js'
import { NeutralHeader } from '../../types.js'
import { NearApi } from '../client.js'
import { NearBlock } from '../types.js'
import { NearWatcher } from './watcher.js'

// Mock fixture blocks representing NEAR chain with skipped height (#101 skipped)
const mockNearBlocks: NearBlock[] = [
  {
    number: 100,
    hash: 'hash_100',
    parentHash: 'hash_99',
    header: { prev_height: 99, prev_hash: 'hash_99' },
  } as any,
  {
    number: 102,
    hash: 'hash_102',
    parentHash: 'hash_100',
    header: { prev_height: 100, prev_hash: 'hash_100' },
  } as any, // 101 skipped!
  {
    number: 103,
    hash: 'hash_103',
    parentHash: 'hash_102',
    header: { prev_height: 102, prev_hash: 'hash_102' },
  } as any,
  {
    number: 104,
    hash: 'hash_104',
    parentHash: 'hash_103',
    header: { prev_height: 103, prev_hash: 'hash_103' },
  } as any,
]

function waitForEmissions<T>(obs: Observable<T>, expectedCount: number, stopFn?: () => void): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const emitted: T[] = []

    const subscription = obs.subscribe({
      next: (val) => {
        emitted.push(val)
        if (emitted.length === expectedCount) {
          subscription.unsubscribe()
          if (stopFn) {
            stopFn()
          }
          resolve(emitted)
        }
      },
      error: (err) => {
        if (stopFn) {
          stopFn()
        }
        reject(err)
      },
      complete: () => {
        if (emitted.length !== expectedCount) {
          if (stopFn) {
            stopFn()
          }
          reject(new Error(`Stream completed early: got ${emitted.length}, expected ${expectedCount}`))
        }
      },
    })
  })
}

function createNearConnector(headersSource: Observable<NeutralHeader>, testBlocks: NearBlock[]) {
  const mockApi = {
    followHeads$: () => headersSource,
    getBlockBalanced(id: string | number) {
      const block = testBlocks.find((b) => b.hash === id || b.number === id)
      if (!block) {
        return Promise.reject(new Error(`Block not found: ${id}`))
      }
      return Promise.resolve(block)
    },
    getNetworkInfo() {
      return Promise.resolve({ chainId: 'urn:ocn:near:397' })
    },
  } as unknown as NearApi

  return {
    connectAll: () => ({
      'urn:ocn:near:397': mockApi,
    }),
  } as unknown as Connector
}

describe('NearWatcher catchup', () => {
  let db: LevelDB
  let services: Services

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(async () => {
    db = new MemoryLevel() as LevelDB
    return db.open()
  })

  describe('finalizedBlocks', () => {
    it('should catch up blocks backward and handle skipped height numbers', async () => {
      // 1. Seed chain tip at block #99 in LevelDB
      await db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:near:397', {
        chainId: 'urn:ocn:near:397',
        blockNumber: '99',
        blockHash: 'hash_99',
      } as unknown as ChainHead)

      // 2. Emit new head at height 104 with parentHeight = 103
      const headersSource = from<NeutralHeader[]>([
        {
          hash: 'hash_104',
          height: 104,
          parenthash: 'hash_103',
          parentHeight: 103,
          status: 'finalized',
        },
      ])

      const watcher = new NearWatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: createNearConnector(headersSource, mockNearBlocks),
        levelDB: db,
      })

      watcher.start()

      // 3. Expect 4 blocks to be caught up: #104, #103, #102, #100 (smoothly skipping missing block #101)
      const blocks = await waitForEmissions(watcher.finalizedBlocks('urn:ocn:near:397' as any), 4, () =>
        watcher.stop(),
      )

      expect(blocks.map((b) => b.number)).toEqual([104, 103, 102, 100])

      // 4. Verify chain tip was updated in LevelDB to highest head #104
      const updatedTip = await db
        .sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded)
        .get('urn:ocn:near:397')

      expect(updatedTip?.blockNumber).toBe('104')
      expect(updatedTip?.blockHash).toBe('hash_104')
    })
  })
})

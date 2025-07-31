import { MemoryLevel } from 'memory-level'
import { Observable, from, map } from 'rxjs'

import Connector from '@/services/networking/connector.js'
import { BlockNumberRange, ChainHead } from '@/services/subscriptions/types.js'
import { LevelDB, Services, jsonEncoded, prefixes } from '@/services/types.js'
import { polkadotBlocks } from '@/testing/blocks.js'
import { mockConfigWS } from '@/testing/configs.js'
import { createServices } from '@/testing/services.js'

import { ApiOps } from '../../types.js'
import { BlockInfo, SubstrateApi } from '../types.js'
import { SubstrateWatcher } from './watcher.js'

function waitForEmissions<T>(obs: Observable<T>, expectedCount: number, stopFn?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let receivedCount = 0

    const subscription = obs.subscribe({
      next: () => {
        receivedCount++
        if (receivedCount === expectedCount) {
          subscription.unsubscribe()
          if (stopFn) {
            stopFn()
          }
          resolve()
        }
      },
      error: (err) => {
        if (stopFn) {
          stopFn()
        }
        reject(err)
      },
      complete: () => {
        if (receivedCount !== expectedCount) {
          if (stopFn) {
            stopFn()
          }
          reject(new Error(`Stream completed early: got ${receivedCount}, expected ${expectedCount}`))
        }
      },
    })
  })
}

function createConnector(headersSource: Observable<BlockInfo>, testHeaders: BlockInfo[]) {
  const mockApi = {
    followHeads$: (finality = 'finalized') =>
      headersSource.pipe(
        map((b) => ({
          parenthash: b.parent,
          height: b.number,
          hash: b.hash,
          status: finality,
        })),
      ),
    getBlock(hash: string) {
      return Promise.resolve(polkadotBlocks.find((p) => p.hash === hash)!)
    },
    getBlockHash(height: number) {
      return Promise.resolve(polkadotBlocks.find((p) => p.number === height)!.hash)
    },
    getNeutralBlockHeader(hash) {
      const h = testHeaders.find((p) => p.hash === hash)!
      return Promise.resolve({
        parenthash: h.parent,
        height: h.number,
        hash: h.hash,
      })
    },
  } as ApiOps
  return {
    connectAll: () => ({
      'urn:ocn:local:0': {
        isReady: () => {
          return Promise.resolve(mockApi)
        },
      } as unknown as SubstrateApi,
    }),
  } as unknown as Connector
}

describe('head catcher', () => {
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
    it('should catch up blocks', async () => {
      // Pretend that we left off at block #23075458
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
        chainId: 'urn:ocn:local:0',
        blockNumber: '23075458',
      } as unknown as ChainHead)
      const testHeaders = polkadotBlocks.map(
        ({ hash, number, parent }) => ({ hash, number, parent }) as BlockInfo,
      )

      // We will emit finalized headers with gaps to force enter catch-up logic multiple times
      const headersSource = from([testHeaders[3], testHeaders[8]])
      const catcher = new SubstrateWatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: createConnector(headersSource, testHeaders),
        levelDB: db,
      })

      await Promise.all([
        waitForEmissions(catcher.finalizedBlocks('urn:ocn:local:0'), 9, () => catcher.stop()),
        waitForEmissions(catcher.finalizedBlocks('urn:ocn:local:0'), 9, () => catcher.stop()),
      ])
    })
  })

  it('should recover block ranges', async () => {
    // Pretend that we left off at block #23075466
    await db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
      chainId: 'urn:ocn:local:0',
      blockNumber: '23075466',
    } as unknown as ChainHead)

    // Pretend that we got interrupted
    const range: BlockNumberRange = {
      fromBlockNum: 23075465,
      toBlockNum: 23075458,
    }
    await db
      .sublevel<string, BlockNumberRange>(prefixes.cache.ranges('urn:ocn:local:0'), jsonEncoded)
      .put(prefixes.cache.keys.range(range), range)

    const testHeaders = polkadotBlocks.map(
      ({ hash, number, parent }) => ({ hash, number, parent }) as BlockInfo,
    )

    // We will emit the last finalized headers
    const headersSource = from([testHeaders[7], testHeaders[8]])
    const blocksSource = from(polkadotBlocks)

    const catcher = new SubstrateWatcher({
      ...services,
      localConfig: mockConfigWS,
      connector: createConnector(headersSource, testHeaders),
      levelDB: db,
    })

    catcher.start()

    // Wait for the blocksSource to complete first,
    // then wait for finalizedBlocks emissions
    await new Promise<void>((resolve, reject) => {
      blocksSource.subscribe({
        complete: async () => {
          try {
            await waitForEmissions(catcher.finalizedBlocks('urn:ocn:local:0'), testHeaders.length, () =>
              catcher.stop(),
            )
            resolve()
          } catch (err) {
            catcher.stop()
            reject(err)
          }
        },
        error: (err) => {
          reject(err)
        },
      })
    })
  })

  describe('outboundUmpMessages', () => {
    it('should get outbound UMP messages from chain storage if using rpc', async () => {
      const mockUpwardMessagesQuery = vi.fn(() => Promise.resolve('0x0'))
      const catcher = new SubstrateWatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: {
          connectAll: () => ({
            'urn:ocn:local:0': {} as unknown as SubstrateApi,
            'urn:ocn:local:1000': {
              getStorage: mockUpwardMessagesQuery,
            } as unknown as SubstrateApi,
            'urn:ocn:local:2032': {} as unknown as SubstrateApi,
          }),
        } as unknown as Connector,
        levelDB: db,
      })

      await new Promise<void>((resolve) => {
        catcher.getStorage('urn:ocn:local:1000', '0x4B1D').subscribe({
          complete: () => {
            expect(mockUpwardMessagesQuery).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('outboundHrmpMessages', () => {
    it('should get outbound HRMP messages from chain storage if using rpc', async () => {
      const mockHrmpOutboundMessagesQuery = vi.fn(() => Promise.resolve('0x0'))
      const catcher = new SubstrateWatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: {
          connectAll: () => ({
            'urn:ocn:local:0': {} as unknown as SubstrateApi,
            'urn:ocn:local:1000': {
              getStorage: mockHrmpOutboundMessagesQuery,
            } as unknown as SubstrateApi,
            'urn:ocn:local:2032': {} as unknown as SubstrateApi,
          }),
        } as unknown as Connector,
        levelDB: db,
      })

      await new Promise<void>((resolve) => {
        catcher.getStorage('urn:ocn:local:1000', '0x4B1D').subscribe({
          complete: () => {
            expect(mockHrmpOutboundMessagesQuery).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })
})

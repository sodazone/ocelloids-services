import { MemoryLevel } from 'memory-level'

import Connector from '@/services/networking/connector.js'
import { ApiClient, BlockInfo } from '@/services/networking/index.js'
import { BlockNumberRange, ChainHead } from '@/services/subscriptions/types.js'
import { LevelDB, Services, jsonEncoded, prefixes } from '@/services/types.js'
import { polkadotBlocks } from '@/testing/blocks.js'
import { mockConfigWS } from '@/testing/configs.js'
import { createServices } from '@/testing/services.js'
import { Observable, from } from 'rxjs'
import { HeadCatcher } from './head-catcher.js'

function createConnector(headersSource: Observable<BlockInfo>, testHeaders: BlockInfo[]) {
  const mockApi = {
    finalizedHeads$: headersSource,
    getBlock(hash: string) {
      return Promise.resolve(polkadotBlocks.find((p) => p.hash === hash)!)
    },
    getBlockHash(height: string) {
      return Promise.resolve(polkadotBlocks.find((p) => p.number === Number(height))!.hash)
    },
    getHeader(hash: string) {
      return Promise.resolve(testHeaders.find((p) => p.hash === hash)!)
    },
  }
  return {
    connect: () => ({
      'urn:ocn:local:0': {
        isReady: () => {
          return Promise.resolve(mockApi)
        },
      } as unknown as ApiClient,
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
    db = new MemoryLevel()
    return db.open()
  })

  describe('finalizedBlocks', () => {
    it.only('should catch up blocks', async () => {
      // Pretend that we left off at block #23075457
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
        chainId: 'urn:ocn:local:0',
        blockNumber: '23075457',
      } as unknown as ChainHead)
      const testHeaders = polkadotBlocks.map(
        ({ hash, number, parent }) => ({ hash, number, parent }) as BlockInfo,
      )

      // We will emit finalized headers with gaps to force enter catch-up logic multiple times
      const headersSource = from([testHeaders[3], testHeaders[8]])
      const catcher = new HeadCatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: createConnector(headersSource, testHeaders),
        levelDB: db,
      })

      await new Promise<void>((resolve) => {
        const cb = [vi.fn(), vi.fn()]
        catcher.start()

        let completes = 0
        catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
          next: (_x) => {
            cb[0]()
          },
          complete: async () => {
            expect(cb[0]).toHaveBeenCalledTimes(9)

            completes++
            if (completes === 2) {
              catcher.stop()
              resolve()
            }
          },
        })

        catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
          next: () => {
            cb[1]()
          },
          complete: async () => {
            expect(cb[1]).toHaveBeenCalledTimes(9)

            completes++
            if (completes === 2) {
              catcher.stop()
              resolve()
            }
          },
        })
      })
    })
  })

  it.only('should recover block ranges', async () => {
    // Pretend that we left off at block #23075466
    db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
      chainId: 'urn:ocn:local:0',
      blockNumber: '23075466',
    } as unknown as ChainHead)
    // Pretend that we got interrupted
    const range: BlockNumberRange = {
      fromBlockNum: '23075465',
      toBlockNum: '23075458',
    }
    db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges('urn:ocn:local:0'), jsonEncoded).put(
      prefixes.cache.keys.range(range),
      range,
    )
    const testHeaders = polkadotBlocks.map(
      ({ hash, number, parent }) => ({ hash, number, parent }) as BlockInfo,
    )
    // We will emit the last finalized headers
    const headersSource = from([testHeaders[7], testHeaders[8]])
    const blocksSource = from(polkadotBlocks)
    const catcher = new HeadCatcher({
      ...services,
      localConfig: mockConfigWS,
      connector: createConnector(headersSource, testHeaders),
      levelDB: db,
    })

    await new Promise<void>((resolve) => {
      const cb = vi.fn()
      catcher.start()

      blocksSource.subscribe({
        complete: async () => {
          catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
            next: (_) => {
              cb()
            },
            complete: async () => {
              catcher.stop()
              expect(cb).toHaveBeenCalledTimes(testHeaders.length)
              resolve()
            },
          })
        },
      })
    })
  })

  describe('outboundUmpMessages', () => {
    it('should get outbound UMP messages from chain storage if using rpc', async () => {
      const mockUpwardMessagesQuery = vi.fn(() => Promise.resolve('0x0'))
      const catcher = new HeadCatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: {
          connect: () => ({
            'urn:ocn:local:0': {} as unknown as ApiClient,
            'urn:ocn:local:1000': {
              getStorage: mockUpwardMessagesQuery,
            } as unknown as ApiClient,
            'urn:ocn:local:2032': {} as unknown as ApiClient,
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
      const catcher = new HeadCatcher({
        ...services,
        localConfig: mockConfigWS,
        connector: {
          connect: () => ({
            'urn:ocn:local:0': {} as unknown as ApiClient,
            'urn:ocn:local:1000': {
              getStorage: mockHrmpOutboundMessagesQuery,
            } as unknown as ApiClient,
            'urn:ocn:local:2032': {} as unknown as ApiClient,
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

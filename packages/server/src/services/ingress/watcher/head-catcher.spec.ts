import { MemoryLevel } from 'memory-level'

import Connector from '@/services/networking/connector.js'
import { ApiClient } from '@/services/networking/index.js'
import { LevelDB, Services } from '@/services/types.js'
import { mockConfigWS } from '@/testing/configs.js'
import { createServices } from '@/testing/services.js'

const HeadCatcher = (await import('./head-catcher.js')).HeadCatcher

describe('head catcher', () => {
  let db: LevelDB
  let services: Services

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(async () => {
    db = new MemoryLevel()
  })

  afterEach(async () => {
    await db.close()
  })

  /* TODO: port test
  describe('finalizedBlocks', () => {
    it.skip('should catch up blocks', (done) => {
      // Load 20 blocks starting from #17844552
      const testBlocks = testBlocksFrom('polkadot-17844552-20.cbor.bin', 'polkadot.json')
      // Pretend that we left off at block #17844551
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
        chainId: 'urn:ocn:local:0',
        blockNumber: '17844551',
      } as unknown as ChainHead)

      const testHeaders = testBlocks.map((tb) => tb.block.header)
      // We will emit finalized headers with gaps to force enter catch-up logic multiple times
      const headersSource = from([testHeaders[3], testHeaders[9], testHeaders[19]])
      const blocksSource = from(testBlocks)

      const mockGetHeader = jest.fn((hash: any) => {
        const found = testHeaders.find((h) => h.hash.toHex() === hash.toHex())
        return found ? Promise.resolve(found) : Promise.reject(`No header for ${hash.toHex()}`)
      })

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigMixed,
        connector: {
          connect: () => ({
            rx: {
              'urn:ocn:local:0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    subscribeFinalizedHeads: () => headersSource,
                  },
                },
              } as unknown as ApiRx),
              'urn:ocn:local:1000': of({} as unknown as ApiRx),
              'urn:ocn:local:2032': of({} as unknown as ApiRx),
            },
            promise: {
              'urn:ocn:local:0': {
                isReady: Promise.resolve({
                  rpc: {
                    chain: {
                      getHeader: mockGetHeader,
                    },
                  },
                  derive: {
                    chain: {
                      getBlock: (hash: any) =>
                        Promise.resolve(testBlocks.find((b) => b.block.hash.toHex() === hash.toHex())),
                    },
                  },
                  registry: {
                    createType: () => ({}),
                    createClass: () => {
                      return class Dummy {
                        block = {
                          extrinsics: [],
                          header: {
                            number: {
                              toBigInt: () => 0n,
                            },
                          },
                        }
                      }
                    },
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        levelDB: db,
      })

      const cb = [jest.fn(), jest.fn()]

      catcher.start()

      blocksSource.subscribe({
        complete: async () => {
          // Blocks should be put in cache
          const blockCache = await sl('urn:ocn:local:0').keys().all()
          expect(blockCache.length).toBe(20)

          let completes = 0
          catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
            next: (_) => {
              cb[0]()
            },
            complete: async () => {
              expect(cb[0]).toHaveBeenCalledTimes(20)

              completes++
              if (completes === 2) {
                catcher.stop()
                done()
              }
            },
          })

          catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
            next: () => {
              cb[1]()
            },
            complete: async () => {
              expect(cb[1]).toHaveBeenCalledTimes(20)

              completes++
              if (completes === 2) {
                catcher.stop()
                done()
              }
            },
          })
        },
      })
    })

    it.skip('should recover block ranges', (done) => {
      // Load 20 blocks starting from #17844552
      const testBlocks = testBlocksFrom('polkadot-17844552-20.cbor.bin', 'polkadot.json')
      // Pretend that we left off at block #17844570
      db.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded).put('urn:ocn:local:0', {
        chainId: 'urn:ocn:local:0',
        blockNumber: '17844570',
      } as unknown as ChainHead)
      // Pretend that we got interrupted
      const range: BlockNumberRange = {
        fromBlockNum: '17844569',
        toBlockNum: '17844551',
      }
      db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges('urn:ocn:local:0'), jsonEncoded).put(
        prefixes.cache.keys.range(range),
        range,
      )
      const testHeaders = testBlocks.map((tb) => tb.block.header)
      // We will emit the last finalized headers
      const headersSource = from([testHeaders[18], testHeaders[19]])
      const blocksSource = from(testBlocks)

      const mockGetHeader = jest.fn((hash: any) => {
        const found = testHeaders.find((h) => h.hash.toHex() === hash.toHex())
        return found ? Promise.resolve(found) : Promise.reject(new Error(`No header for ${hash.toHex()}`))
      })

      const mockGetHash = jest.fn((blockNumber: any) => {
        const found = testHeaders.find((h) => h.number.toString() === blockNumber.toString())
        return found ? Promise.resolve(found.hash) : Promise.reject(new Error(`No hash for ${blockNumber}`))
      })

      const catcher = new HeadCatcher({
        ..._services,
        localConfig: mockConfigWS,
        connector: {
          connect: () => ({
            rx: {
              'urn:ocn:local:0': of({
                derive: {
                  chain: {
                    subscribeNewBlocks: () => blocksSource,
                    subscribeFinalizedHeads: () => headersSource,
                  },
                },
              } as unknown as ApiRx),
              'urn:ocn:local:1000': of({} as unknown as ApiRx),
              'urn:ocn:local:2032': of({} as unknown as ApiRx),
            },
            promise: {
              'urn:ocn:local:0': {
                isReady: Promise.resolve({
                  rpc: {
                    chain: {
                      getBlockHash: mockGetHash,
                      getHeader: mockGetHeader,
                    },
                  },
                  derive: {
                    chain: {
                      getBlock: (hash: any) => {
                        return Promise.resolve(testBlocks.find((b) => b.block.hash.toHex() === hash.toHex()))
                      },
                    },
                  },
                  registry: {
                    createType: () => ({}),
                  },
                } as unknown as ApiPromise),
              },
            },
          }),
        } as unknown as Connector,
        levelDB: db,
      })

      const cb = jest.fn()

      catcher.start()

      blocksSource.subscribe({
        complete: async () => {
          catcher.finalizedBlocks('urn:ocn:local:0').subscribe({
            next: (_) => {
              cb()
            },
            complete: async () => {
              catcher.stop()
              done()
              expect(cb).toHaveBeenCalledTimes(20)
            },
          })
        },
      })
    })
  })
  */

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

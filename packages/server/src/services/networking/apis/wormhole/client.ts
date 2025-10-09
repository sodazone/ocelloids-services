import ky from 'ky'

import { normalizeWormholeId, WormholeId } from './ids.js'
import { WormholeOperation } from './types.js'

type WormholeOperationParams = {
  pageSize?: number
  from?: string // ISO time
  to?: string // ISO time
  sourceChain?: string | number // number or comma separated
  targetChain?: string | number
  address?: string // emitter address
}

export class WormholescanClient {
  readonly #api

  constructor(baseUrl = 'https://api.wormholescan.io') {
    this.#api = ky.create({
      prefixUrl: baseUrl,
      /*hooks: {
        beforeRequest: [
          (request) => {
            console.log('Fetching:', request.url)
          },
        ],
      },*/
      timeout: 10_000,
      retry: {
        limit: 5,
        methods: ['get'],
        statusCodes: [408, 429, 500, 502, 503, 504],
        backoffLimit: 2,
      },
    })
  }

  /**
   * Fetch operations for a given page.
   */
  async fetchOperations(
    params: WormholeOperationParams & { page?: number },
    signal?: AbortSignal | null,
  ): Promise<{ operations: WormholeOperation[]; total: number }> {
    const { page = 0, pageSize = 100, ...query } = params

    return this.#api
      .get('api/v1/operations', {
        searchParams: {
          ...query,
          page,
          pageSize,
        },
        signal,
      })
      .json<{ operations: WormholeOperation[]; total: number }>()
  }

  /**
   * Fetch all operations, automatically handling pagination.
   */
  async fetchAllOperations(
    params: WormholeOperationParams,
    signal?: AbortSignal | null,
  ): Promise<WormholeOperation[]> {
    const { pageSize = 100, ...query } = params
    let page = 0
    let results: WormholeOperation[] = []

    while (true) {
      const data = await this.#api
        .get('api/v1/operations', {
          searchParams: {
            ...query,
            page,
            pageSize,
          },
          signal,
        })
        .json<{ operations: WormholeOperation[]; total: number }>()

      results = results.concat(data.operations)

      if (data.operations.length < pageSize) {
        break
      }
      page++
    }

    return results
  }

  /**
   * Fetch a single operation by its ID triplet.
   */
  async fetchOperationById(id: WormholeId, signal?: AbortSignal | null): Promise<WormholeOperation> {
    const urlId = normalizeWormholeId(id)
    const op = await this.#api.get(`api/v1/operations/${urlId}`, { signal }).json<WormholeOperation>()

    return op
  }
}

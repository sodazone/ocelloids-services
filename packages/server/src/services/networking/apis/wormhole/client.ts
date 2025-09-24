import ky from 'ky'

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
      timeout: 10000,
      retry: {
        limit: 5,
        methods: ['get'],
        statusCodes: [408, 429, 500, 502, 503, 504],
        backoffLimit: 2,
      },
    })
  }

  /**
   * Fetch all operations, automatically handling pagination.
   */
  async fetchAllOperations(params: WormholeOperationParams): Promise<WormholeOperation[]> {
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
  async fetchOperationById(
    chainId: string | number,
    emitterAddress: string,
    sequence: string | number,
  ): Promise<WormholeOperation> {
    const op = await this.#api
      .get(`api/v1/operations/${chainId}/${emitterAddress}/${sequence}`)
      .json<WormholeOperation>()

    return op
  }
}

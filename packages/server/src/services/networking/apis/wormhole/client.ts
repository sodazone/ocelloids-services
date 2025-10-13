import ky from 'ky'

import { WormholeId, normalizeWormholeId } from './ids.js'
import { WormholeOperation } from './types.js'

type WormholeOperationParams = {
  pageSize?: number
  from?: string // ISO time
  to?: string // ISO time
  sourceChain?: string | number // number or comma separated
  targetChain?: string | number
  address?: string // emitter address
}

function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 5,
    delay = 2000,
    exponential = true,
  }: { retries?: number; delay?: number; exponential?: boolean } = {},
): Promise<T> {
  return (async function retry(attempt = 0): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries) {
        throw err
      }
      const backoff = exponential ? delay * 2 ** attempt : delay
      console.warn(`Retrying after ${backoff}ms (attempt ${attempt + 1}) due to`, err)
      await new Promise((r) => setTimeout(r, backoff))
      return retry(attempt + 1)
    }
  })()
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
    const { page = 0, pageSize = 25, ...query } = params

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
   * Stream all operations since a given timestamp, handling pagination.
   */
  async *streamAllOperations(
    params: WormholeOperationParams,
    signal?: AbortSignal | null,
  ): AsyncGenerator<WormholeOperation, void, unknown> {
    const { pageSize = 25, ...query } = params
    let page = 0

    while (true) {
      const data = await withRetry(
        async () => {
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          return await this.#api
            .get('api/v1/operations', {
              searchParams: { ...query, page, pageSize },
              signal,
            })
            .json<{ operations: WormholeOperation[]; total: number }>()
        },
        {
          retries: 5,
          delay: 2000,
          exponential: true,
        },
      )

      for (const op of data.operations) {
        yield op
      }

      if (data.operations.length < pageSize) {
        break
      }
      page++
    }
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

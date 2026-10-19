import { JsonRpcProvider } from 'near-api-js'
import { defer, Observable, retry, switchMap, timer } from 'rxjs'
import { Logger } from '@/services/types.js'
import { ApiClient, Finality, NeutralHeader } from '../types.js'
import { NearBlock, NearChunk, NearNetworkInfo, NearTxStatus } from './types.js'

type ProviderStat = {
  url: string
  requests: number[]
  rateLimitedUntil: number
  totalRequests: number
  errors: number
  inflight: number
}

const POLL_INTERVAL_MS = 3000
const MAX_SEEN_BLOCKS = 128
const EMPTY_TX_ROOT = '11111111111111111111111111111111'
const FASTNEAR_BASE_URL = 'https://mainnet.neardata.xyz'
const FASTNEAR_API_LIMIT = 30
const RPC_TIMEOUT_MS = 10_000 // 10 seconds timeout per provider attempt

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage))
    }, ms)

    promise
      .then((res) => {
        clearTimeout(timer)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

function reliableNearTimestamp(block: any): number {
  const ns = Number(block.header?.timestamp ?? block.header?.timestamp_nanosec ?? 0)
  return ns > 0 ? Math.floor(ns / 1_000_000) : Date.now()
}

export class NearApi implements ApiClient {
  readonly chainId: string
  readonly #log: Logger
  readonly #provider: JsonRpcProvider
  readonly #providers: JsonRpcProvider[]
  readonly #providerUrls: string[]
  readonly #stats: Map<string, ProviderStat> = new Map()
  #currentRpcIndex = 0
  #rpcLock: Promise<void> = Promise.resolve()

  constructor(log: Logger, chainId: string, url: string | string[]) {
    this.chainId = chainId
    this.#log = log
    this.#providerUrls = Array.isArray(url) ? url : [url]

    this.#providers = this.#providerUrls.map((endpoint) => new JsonRpcProvider({ url: endpoint }))
    this.#provider = this.#providers[0]

    this.#log.info(
      '[client:%s] NEAR JSON-RPC provider pool created with %d endpoint(s): %o',
      this.chainId,
      this.#providers.length,
      this.#providerUrls,
    )
  }

  async #withLock<T>(action: () => T | Promise<T>): Promise<T> {
    let release: () => void = () => {
      // noop
    }
    const nextLock = new Promise<void>((resolve) => {
      release = resolve
    })
    const prevLock = this.#rpcLock
    this.#rpcLock = nextLock

    await prevLock
    try {
      return await action()
    } finally {
      release()
    }
  }

  #recordRequest(key: string) {
    const now = Date.now()
    let stat = this.#stats.get(key)
    if (!stat) {
      stat = { url: key, requests: [], rateLimitedUntil: 0, totalRequests: 0, errors: 0, inflight: 0 }
      this.#stats.set(key, stat)
    }
    stat.totalRequests++
    stat.requests.push(now)
    stat.requests = stat.requests.filter((t) => now - t < 60000)
  }

  #getRate(key: string): number {
    const stat = this.#stats.get(key)
    if (!stat) {
      return 0
    }
    const now = Date.now()
    stat.requests = stat.requests.filter((t) => now - t < 60000)
    return stat.requests.length
  }

  #logRates() {
    const rates: Record<string, number> = {}
    for (const [key] of this.#stats.entries()) {
      rates[key] = this.#getRate(key)
    }
    this.#log.info('[client:%s] Request rates (last 60s req/min): %o', this.chainId, rates)
  }

  async #executeRpc<T>(fn: (provider: JsonRpcProvider, url: string) => Promise<T>): Promise<T> {
    const numProviders = this.#providers.length
    let attempts = 0

    while (attempts < numProviders) {
      // 1. Atomically select and RESERVE the best available provider under lock
      const selected = await this.#withLock(() => {
        let currentAttempts = 0
        let bestProviderIndex = -1
        let lowestInflight = Infinity

        // Scan providers to find a healthy one with the lowest current in-flight load
        while (currentAttempts < numProviders) {
          const providerIndex = (this.#currentRpcIndex + currentAttempts) % numProviders
          const url = this.#providerUrls[providerIndex]
          let stat = this.#stats.get(url)

          if (!stat) {
            stat = { url, requests: [], rateLimitedUntil: 0, totalRequests: 0, errors: 0, inflight: 0 }
            this.#stats.set(url, stat)
          }

          if (Date.now() >= stat.rateLimitedUntil && stat.inflight < lowestInflight) {
            lowestInflight = stat.inflight
            bestProviderIndex = providerIndex
            // If we found one with 0 in-flight requests, we can stop searching early
            if (lowestInflight === 0) {
              break
            }
          }
          currentAttempts++
        }

        if (bestProviderIndex === -1) {
          return { provider: null, url: null, stat: null }
        }

        // Advance rotation index and reserve this provider atomically
        this.#currentRpcIndex = (bestProviderIndex + 1) % numProviders
        const url = this.#providerUrls[bestProviderIndex]
        const stat = this.#stats.get(url)!

        stat.inflight++
        this.#recordRequest(url)

        return {
          provider: this.#providers[bestProviderIndex],
          url,
          stat,
        }
      })

      const { provider, url, stat } = selected
      if (!provider || !url || !stat) {
        break
      }

      try {
        const result = await withTimeout(
          fn(provider, url),
          RPC_TIMEOUT_MS,
          `[${this.chainId}] RPC call to ${url} timed out after ${RPC_TIMEOUT_MS}ms`,
        )
        return result
      } catch (err: any) {
        // 2. Handle errors and update rate-limit state under lock
        await this.#withLock(() => {
          const errMsg = err?.message || String(err)
          const isRateLimit =
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('too many requests') ||
            errMsg.toLowerCase().includes('rate limit exceeded') ||
            errMsg.toLowerCase().includes('retry after') ||
            err?.status === 429 ||
            err?.statusCode === 429

          if (isRateLimit) {
            const match = errMsg.match(/retry after (\d+) seconds/i)
            const suggestedSeconds = match ? parseInt(match[1], 10) : 30
            const cooldownMs = (suggestedSeconds + 10) * 1000

            this.#log.warn(
              '[client:%s] RPC provider %s hit rate limit: %s. Backing off for %ds and rotating.',
              this.chainId,
              url,
              errMsg,
              Math.round(cooldownMs / 1000),
            )
            this.#logRates()
            stat.rateLimitedUntil = Date.now() + cooldownMs
            stat.errors++
          } else {
            this.#log.warn(
              err,
              '[client:%s] RPC provider %s failed: %s. Trying next provider.',
              this.chainId,
              url,
              errMsg,
            )
            stat.errors++
          }
        })
        attempts++
      } finally {
        // 3. Always release the in-flight reservation safely under lock
        await this.#withLock(() => {
          if (stat) {
            stat.inflight = Math.max(0, stat.inflight - 1)
          }
        })
      }
    }

    throw new Error(`[${this.chainId}] All ${numProviders} RPC providers failed or hit rate limits.`)
  }

  async connect(): Promise<ApiClient> {
    this.#log.info('[%s] connected (immediate)', this.chainId)
    return this
  }

  async disconnect(): Promise<void> {
    this.#log.info('[%s] disconnected', this.chainId)
  }

  async getBlockHash(height: number): Promise<string> {
    const block = await this.#executeRpc((provider) => provider.viewBlock({ blockId: height }))
    if (!block || !block.header) {
      throw new Error(`[${this.chainId}] Block at height #${height} not found`)
    }
    return block.header.hash
  }

  async getNeutralBlockHeader(hash: string): Promise<NeutralHeader> {
    const block = await this.#executeRpc((provider) => provider.viewBlock({ blockId: hash }))
    if (!block || !block.header) {
      throw new Error(`[${this.chainId}] Block with hash ${hash} not found`)
    }
    return {
      hash: block.header.hash,
      height: block.header.height,
      parenthash: block.header.prev_hash,
      parentHeight: block.header.prev_height,
    }
  }

  async getNeutralBlockHeaderByNumber(height: number): Promise<NeutralHeader> {
    const block = await this.#executeRpc((provider) => provider.viewBlock({ blockId: height }))
    if (!block || !block.header) {
      throw new Error(`[${this.chainId}] Block at height #${height} not found`)
    }
    return {
      hash: block.header.hash,
      height: block.header.height,
      parenthash: block.header.prev_hash,
      parentHeight: block.header.prev_height,
    }
  }

  /**
   * Subscribes to new heads
   */
  followHeads$(finality: Finality, confirmationsOverride?: number): Observable<NeutralHeader> {
    const nearFinality = finality === 'finalized' ? 'final' : 'optimistic'
    const confirmations = confirmationsOverride ?? 60

    const buffer: NeutralHeader[] = []
    const seenBlocks: Set<string> = new Set()

    return new Observable<NeutralHeader>((subscriber) => {
      const subscription = timer(0, POLL_INTERVAL_MS)
        .pipe(
          switchMap(() =>
            defer(async () => {
              return await this.#executeRpc((provider) =>
                provider.viewBlock({ finality: nearFinality as any }),
              )
            }).pipe(retry({ count: 3, delay: 500 })),
          ),
        )
        .subscribe({
          next: async (block: any) => {
            if (!block || !block.header) {
              return
            }

            try {
              const { height, hash, prev_hash: parenthash, prev_height: parentHeight } = block.header
              const seenKey = `${height}:${hash}`

              if (seenBlocks.has(seenKey)) {
                return
              }
              seenBlocks.add(seenKey)

              if (seenBlocks.size > MAX_SEEN_BLOCKS) {
                const oldest = seenBlocks.values().next().value!
                seenBlocks.delete(oldest)
              }

              const header: NeutralHeader = {
                hash,
                height,
                parenthash,
                parentHeight,
                status: finality,
                ingestionMode: 'live',
              }

              // If confirmations = 0, emit immediately
              if (confirmations === 0) {
                subscriber.next(header)
                return
              }

              buffer.push(header)

              // Emit blocks that have reached the required confirmation lag from the tip
              while (buffer.length > 0 && buffer[0].height + confirmations <= height) {
                const finalizedBlock = buffer.shift()!
                subscriber.next(finalizedBlock)
              }
            } catch (err) {
              subscriber.error(err as Error)
            }
          },
          error: (err) => subscriber.error(err),
        })

      return () => {
        subscription.unsubscribe()
      }
    })
  }

  async getBlock(blockId: string | number | { finality: 'final' | 'optimistic' }): Promise<NearBlock> {
    return await this.getBlockBalanced(blockId)
  }

  async #getBlockViaRpc(blockId: string | number | { finality: 'final' | 'optimistic' }): Promise<NearBlock> {
    // 1. Fetch block header using the load balancer
    const block = await this.#executeRpc(async (provider) => {
      if (typeof blockId === 'string' || typeof blockId === 'number') {
        return await provider.viewBlock({ blockId: blockId as any })
      } else {
        return await provider.viewBlock(blockId as any)
      }
    })

    if (!block || !block.header) {
      throw new Error(`[${this.chainId}] Block not found for identifier: ${JSON.stringify(blockId)}`)
    }

    // 2. Fetch chunk details concurrently, spreading each request across available RPC providers
    const chunkPromises = (block.chunks || []).map(async (chunkHeader) => {
      if (chunkHeader.tx_root && chunkHeader.tx_root !== EMPTY_TX_ROOT && chunkHeader.chunk_hash) {
        try {
          const chunkDetails = await this.#executeRpc((provider) =>
            provider.viewChunk(chunkHeader.chunk_hash),
          )
          return { ...chunkHeader, ...chunkDetails } as NearChunk
        } catch (_e) {
          return null
        }
      }
      return null
    })

    const chunksWithTransactions = await Promise.all(chunkPromises)
    const transactions = chunksWithTransactions.filter((c) => c !== null).flatMap((c) => c.transactions)

    return {
      ...block,
      transactions,
      timestamp: reliableNearTimestamp(block),
      number: block.header.height,
      hash: block.header.hash,
      parentHash: block.header.prev_hash,
    }
  }

  async getBlockBalanced(
    blockId: string | number | { finality: 'final' | 'optimistic' },
  ): Promise<NearBlock> {
    const fastNearKey = 'fastnear'
    const fastNearRate = this.#getRate(fastNearKey)
    const fastNearStat = this.#stats.get(fastNearKey)
    const isFastNearRateLimited = fastNearStat && Date.now() < fastNearStat.rateLimitedUntil

    if (fastNearRate < FASTNEAR_API_LIMIT && !isFastNearRateLimited) {
      try {
        return await this.getBlockFast(blockId)
      } catch (err: any) {
        this.#logRates()
        this.#log.warn(
          '[client:%s] FastNEAR failed: %s. Falling back to RPC load balancer.',
          this.chainId,
          err?.message,
        )
      }
    } else {
      this.#log.debug(
        '[client:%s] FastNEAR rate approaching/at threshold (%d/25 req/min). Routing to RPC load balancer.',
        this.chainId,
        fastNearRate,
      )
    }

    try {
      return await this.#getBlockViaRpc(blockId)
    } catch (rpcErr: any) {
      this.#log.warn(
        '[client:%s] RPC pool failed (%s). Attempting emergency fallback to FastNEAR.',
        this.chainId,
        rpcErr?.message,
      )

      try {
        return await this.getBlockFast(blockId)
      } catch (fallbackErr: any) {
        throw new Error(
          `[${this.chainId}] Both RPC pool and emergency FastNEAR fallback failed for block ${JSON.stringify(blockId)}. RPC error: ${rpcErr?.message}, FastNEAR error: ${fallbackErr?.message}`,
        )
      }
    }
  }

  async getBlockFast(blockId: string | number | { finality: 'final' | 'optimistic' }): Promise<NearBlock> {
    const fastNearKey = 'fastnear'
    this.#recordRequest(fastNearKey)

    let endpoint = ''
    if (typeof blockId === 'number') {
      endpoint = `${FASTNEAR_BASE_URL}/v0/block/${blockId}`
    } else if (typeof blockId === 'object' && 'finality' in blockId) {
      endpoint = `${FASTNEAR_BASE_URL}/v0/last_block/${blockId.finality}`
    } else if (typeof blockId === 'string') {
      if (/^\d+$/.test(blockId)) {
        endpoint = `${FASTNEAR_BASE_URL}/v0/block/${blockId}`
      } else {
        const blockHeader = await this.#executeRpc((provider) => provider.viewBlock({ blockId }))
        if (!blockHeader || !blockHeader.header) {
          throw new Error(`[${this.chainId}] Block not found for hash: ${blockId}`)
        }
        endpoint = `${FASTNEAR_BASE_URL}/v0/block/${blockHeader.header.height}`
      }
    }

    const res = await fetch(endpoint)
    if (res.status === 404) {
      throw new Error(`[${this.chainId}] Block not found via FastNEAR: ${JSON.stringify(blockId)}`)
    }
    if (res.status === 429) {
      let stat = this.#stats.get(fastNearKey)
      if (!stat) {
        stat = {
          url: fastNearKey,
          requests: [],
          rateLimitedUntil: 0,
          totalRequests: 0,
          errors: 0,
          inflight: 0,
        }
        this.#stats.set(fastNearKey, stat)
      }
      stat.rateLimitedUntil = Date.now() + 60_000
      stat.errors++
      const errText = await res.text().catch(() => 'rate-limit exceeded')
      this.#logRates()
      throw new Error(`[${this.chainId}] FastNEAR API error (429): ${errText}`)
    }
    if (!res.ok) {
      const errText = await res.text()
      this.#logRates()
      throw new Error(`[${this.chainId}] FastNEAR API error (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as {
      block: {
        author: string
        chunks: any[]
        header: any
      }
      shards: Array<{
        chunk: {
          author: string
          header: any
          transactions?: Array<{
            outcome: any
            transaction: {
              actions: any[]
              hash: string
              nonce: number
              priority_fee?: number
              public_key: string
              receiver_id: string
              signature: string
              signer_id: string
            }
          }>
        }
      }>
    }

    if (!data || !data.block || !data.block.header) {
      throw new Error(
        `[${this.chainId}] Invalid block data returned from FastNEAR for: ${JSON.stringify(blockId)}`,
      )
    }

    const block = data.block
    const transactions = (data.shards || []).flatMap((shard) =>
      (shard.chunk?.transactions || []).map((item) => item.transaction),
    )

    return {
      ...block,
      transactions,
      timestamp: reliableNearTimestamp(block),
      number: block.header.height,
      hash: block.header.hash,
      parentHash: block.header.prev_hash,
    }
  }

  async getTransactionStatus(txHash: string, senderAccountId: string): Promise<NearTxStatus> {
    const status = await this.#executeRpc((provider) =>
      provider.viewTransactionStatus({
        txHash,
        accountId: senderAccountId,
      }),
    )
    return status as NearTxStatus
  }

  async getNetworkInfo(): Promise<NearNetworkInfo> {
    try {
      const status = await this.#executeRpc((provider) => provider.viewNodeStatus())

      return {
        chainId: this.chainId,
        networkId: status.chain_id,
        rpcUrl: this.#provider.connection.url,
        latestBlockHeight: status.sync_info.latest_block_height,
        syncing: status.sync_info.syncing,
        protocolVersion: status.version.version,
        nodeSoftwareVersion: status.version.build,
      }
    } catch (_error) {
      return {
        chainId: this.chainId,
        rpcUrl: this.#provider.connection.url,
      }
    }
  }
}

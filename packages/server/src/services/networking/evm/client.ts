import { Observable } from 'rxjs'
import {
  AbiEvent,
  createPublicClient,
  fallback,
  http,
  MulticallParameters,
  MulticallReturnType,
  PublicClient,
  TransactionReceipt,
  Transport,
  Block as ViemBlock,
  webSocket,
} from 'viem'
import * as viemChains from 'viem/chains'
import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { Logger } from '@/services/types.js'
import { ApiClient, Finality, NeutralHeader } from '../types.js'
import { Block, BlockWithLogs, DecodeContractParams, DecodedLog } from './types.js'

const MAX_SEEN_BLOCKS = 128
const MAX_RPC_CONCURRENCY = 10
// TODO: move to config
const defaultConfirmations: Record<string, number> = {
  ethereum: 1,
  polygon: 1,
  arbitrum: 0,
  optimism: 0,
}

function asTransport(url: string) {
  if (url.startsWith('http')) {
    return http(url)
  }
  if (url.startsWith('ws')) {
    return webSocket(url)
  }
  throw new Error(`Unsupported transport: ${url}`)
}

export function resolveChain(chainId: string) {
  if (!chainId.startsWith('urn:ocn:ethereum:')) {
    throw new Error(
      `Malformed EVM chain identifier: ${chainId}. Expected format: 'urn:ocn:ethereum:{viem-chain-name|chain-id}'`,
    )
  }

  const chainValue = chainId.substring(17)

  // lookup by viem export name
  if (chainValue in viemChains) {
    // @ts-expect-error namespace import has no index signature
    return viemChains[chainValue] as Chain
  }

  // lookup by numeric chain ID
  const asNumber = Number(chainValue)
  if (!Number.isNaN(asNumber)) {
    const match = Object.values(viemChains).find((chain: any) => chain.id === asNumber)
    if (match) {
      return match
    }
  }

  throw new Error(`Unknown chain definition for: ${chainValue} (${chainId})`)
}

function markSeen(seenBlocks: Set<string>, blockId: string) {
  seenBlocks.add(blockId)
  if (seenBlocks.size > MAX_SEEN_BLOCKS) {
    const oldest = seenBlocks.values().next().value!
    seenBlocks.delete(oldest)
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function getWsEndpoints(endpoints: string[]) {
  return endpoints.filter((url) => url.startsWith('wss://') || url.startsWith('ws://'))
}

function getHttpEndpoints(endpoints: string[]) {
  return endpoints.filter((url) => url.startsWith('https://') || url.startsWith('http://'))
}

function reliableTimestamp(block: ViemBlock) {
  const timestampInBlock = Number(block.timestamp ?? 0)
  return timestampInBlock === 0 ? Date.now() / 1_000 : timestampInBlock
}

export class EvmApi implements ApiClient {
  readonly chainId: string

  readonly #log: Logger
  readonly #client: PublicClient<Transport, viemChains.Chain>
  readonly #wsClient: PublicClient<Transport, viemChains.Chain>
  readonly #unwatches: Set<() => void> = new Set()

  constructor(log: Logger, chainId: string, url: string | string[]) {
    this.chainId = chainId

    this.#log = log

    const endpoints = Array.isArray(url) ? url : [url]
    const wsEndpoints = shuffle(getWsEndpoints(endpoints))
    const httpEndpoints = shuffle(getHttpEndpoints(endpoints))

    this.#client = createPublicClient<Transport, viemChains.Chain>({
      chain: resolveChain(chainId),
      transport: fallback(httpEndpoints.map(asTransport)),
    })
    this.#wsClient = createPublicClient<Transport, viemChains.Chain>({
      chain: resolveChain(chainId),
      transport: fallback(wsEndpoints.map(asTransport)),
    })
    this.#log.info('[%s] Public client created with RPC %s', this.chainId, httpEndpoints[0])
    this.#log.info('[%s] WS Public client created with RPC %s', this.chainId, wsEndpoints[0])
  }

  async connect(): Promise<ApiClient> {
    this.#log.info('[%s] connected (immediate)', this.chainId)
    return this
  }

  async disconnect(): Promise<void> {
    for (const unwatch of this.#unwatches) {
      try {
        unwatch()
      } catch (err) {
        this.#log.error('[%s] error during unwatch: %O', this.chainId, err)
      }
    }
    this.#unwatches.clear()
    this.#log.info('[%s] disconnected', this.chainId)
  }

  /**
   * Subscribe to new heads.
   *
   * Emits blocks based on the requested finality:
   * - 'new': emits immediately. Low-latency use cases (monitoring, dashboards, analytics)
   *          can tolerate short reorgs.
   * - 'finalized': waits for confirmations. Useful when block certainty is required
   *          (settlements, irreversible actions, reporting).
   *
   * Reorg Handling:
   * - Short reorgs at the chain tip are possible (e.g., 1–2 blocks on Ethereum L1).
   * - Blocks beyond the fork point are discarded to avoid emitting stale/forked data.
   *
   * Rationale:
   * - 'new' trades some safety for immediacy; consumers should handle possible short reorgs.
   * - L2s like Optimism/Arbitrum are effectively final immediately.
   * - PoS chains like Polygon rarely have short reorgs; 0–1 confirmations often suffice.
   * - Ethereum L1 typically uses 1–2 confirmations for tip safety.
   *
   * @param finality - 'new' emits immediately, 'finalized' waits for confirmations
   * @param confirmationsOverride - optional number of confirmations instead of chain default
   */
  followHeads$(finality: Finality, confirmationsOverride?: number): Observable<NeutralHeader> {
    const chainName = ((this.#client.chain as any).name as string).toLowerCase()
    const confirmations =
      finality === 'finalized' ? (confirmationsOverride ?? defaultConfirmations[chainName] ?? 12) : 0

    const buffer: NeutralHeader[] = []
    let lastEmittedBlock: NeutralHeader | null = null
    let lastSeenHeight: number | null = null
    const seenBlocks: Set<string> = new Set()

    return new Observable<NeutralHeader>((subscriber) => {
      try {
        const unwatch = this.#client.watchBlocks({
          onBlock: async (block) => {
            if (block === undefined || block === null) {
              this.#log.warn('[%s] Received undefined block on watchBlocks', this.chainId)
              return
            }
            try {
              const header: NeutralHeader = {
                hash: block.hash!,
                height: Number(block.number),
                parenthash: block.parentHash!,
                status: finality,
              }

              // Skip duplicates
              const seen = `${header.height}:${header.hash}`
              if (seenBlocks.has(seen)) {
                return
              }
              markSeen(seenBlocks, seen)

              // Detect gap
              if (lastSeenHeight !== null && header.height > lastSeenHeight + 1) {
                const gapStart = lastSeenHeight + 1
                const gapEnd = header.height - 1

                const heights: number[] = []
                for (let h = gapStart; h <= gapEnd; h++) {
                  heights.push(h)
                }

                // Split into batches
                for (let i = 0; i < heights.length; i += MAX_RPC_CONCURRENCY) {
                  const batch = heights.slice(i, i + MAX_RPC_CONCURRENCY)

                  const blocks = await Promise.all(
                    batch.map((h) => this.#client.getBlock({ blockNumber: BigInt(h) })),
                  )

                  for (const missedBlock of blocks) {
                    const missedHeader: NeutralHeader = {
                      hash: missedBlock.hash!,
                      height: Number(missedBlock.number),
                      parenthash: missedBlock.parentHash!,
                      status: finality,
                    }
                    buffer.push(missedHeader)
                  }
                }
              }

              lastSeenHeight = header.height

              // If confirmations = 0, emit immediately
              if (confirmations === 0) {
                subscriber.next(header)
                lastEmittedBlock = header
                return
              }

              // Detect short reorgs: if parent hash doesn't match last emitted block
              if (lastEmittedBlock && header.parenthash !== lastEmittedBlock.hash) {
                while (buffer.length && buffer[buffer.length - 1].height >= header.height) {
                  buffer.pop()
                }
                lastEmittedBlock = null
              }

              buffer.push(header)

              // Emit blocks that reached required confirmations
              while (buffer.length > 0 && buffer[0].height + confirmations <= header.height) {
                const finalizedBlock = buffer.shift()!
                subscriber.next(finalizedBlock)
                lastEmittedBlock = finalizedBlock
              }
            } catch (err) {
              subscriber.error(err as Error)
            }
          },
          onError: (err) => subscriber.error(err),
        })

        this.#unwatches.add(unwatch)

        return () => {
          try {
            unwatch()
          } finally {
            this.#unwatches.delete(unwatch)
          }
        }
      } catch (err) {
        subscriber.error(err as Error)
      }
    })
  }

  followFastHeads$(finality: Finality, confirmationsOverride?: number) {
    const chainName = ((this.#client.chain as any).name as string).toLowerCase()
    const confirmations =
      finality === 'finalized' ? (confirmationsOverride ?? defaultConfirmations[chainName] ?? 12) : 0

    const buffer: NeutralHeader[] = []
    const seenBlocks: Set<string> = new Set()

    return new Observable<NeutralHeader>((subscriber) => {
      const unwatch = this.#client.watchBlocks({
        includeTransactions: false,
        emitMissed: true,
        onBlock: async (block: any) => {
          if (block === undefined || block === null) {
            this.#log.debug('[%s] Received undefined block on watchBlocks', this.chainId)
            return
          }
          try {
            const header: NeutralHeader = {
              hash: block.hash!,
              height: Number(block.number),
              parenthash: block.parentHash!,
              status: finality,
            }

            const seen = `${header.height}:${header.hash}`
            if (seenBlocks.has(seen)) {
              return
            }
            markSeen(seenBlocks, seen)

            buffer.push(header)

            // Emit immediately for 'new' blocks
            if (confirmations === 0) {
              while (buffer.length) {
                const next = buffer.shift()!
                subscriber.next(next)
              }
              return
            }

            // Emit blocks that reached required confirmations
            while (buffer.length > 0 && buffer[0].height + confirmations <= header.height) {
              const finalized = buffer.shift()!
              subscriber.next(finalized)
            }
          } catch (err) {
            subscriber.error(err as Error)
          }
        },
        onError: (err) => subscriber.error(err),
      })

      this.#unwatches.add(unwatch)
      return () => {
        try {
          unwatch()
        } finally {
          this.#unwatches.delete(unwatch)
        }
      }
    })
  }

  watchEvents$(params: DecodeContractParams, eventNames: string[] = []): Observable<DecodedLog> {
    return new Observable<DecodedLog>((subscriber) => {
      const unwatch = this.#wsClient.watchEvent({
        address: params.addresses,
        events: params.abi.filter(
          (item) => item.type === 'event' && eventNames.includes(item.name),
        ) as AbiEvent[],
        onLogs: (logs) => {
          try {
            for (const log of logs) {
              subscriber.next(asSerializable<typeof log>(log))
            }
          } catch (err) {
            subscriber.error(err as Error)
          }
        },
        onError: (err) => subscriber.error(err),
      })

      this.#unwatches.add(unwatch)
      return () => {
        try {
          unwatch()
        } finally {
          this.#unwatches.delete(unwatch)
        }
      }
    })
  }

  async getBlockHash(height: number): Promise<string> {
    const block = await this.#client.getBlock({ blockNumber: BigInt(height) })
    return block.hash
  }

  async getNeutralBlockHeader(hash: string): Promise<NeutralHeader> {
    const block = await this.#client.getBlock({ blockHash: hash as `0x${string}` })

    if (block === null) {
      throw new Error(`[${this.chainId}] Block with hash ${hash} not found`)
    }

    return {
      hash: block.hash,
      height: Number(block.number),
      parenthash: block.parentHash,
    }
  }

  async getNeutralBlockHeaderByNumber(height: bigint | number): Promise<NeutralHeader> {
    const block = await this.#client.getBlock({ blockNumber: BigInt(height) })

    if (block === null) {
      throw new Error(`[${this.chainId}] Block at height #${height} not found`)
    }

    return {
      hash: block.hash,
      height: Number(block.number),
      parenthash: block.parentHash,
    }
  }

  async getBlockByNumber(height: bigint | number): Promise<Block> {
    const block = await this.#client.getBlock<true>({
      blockNumber: BigInt(height),
      includeTransactions: true,
    })

    if (block === null) {
      throw new Error(`[${this.chainId}] Block with hash ${height} not found`)
    }

    return asSerializable<typeof block>({ ...block, timestamp: reliableTimestamp(block) })
  }

  async getBlock(hash: string): Promise<Block> {
    const block = await this.#client.getBlock<true>({
      blockHash: hash as HexString,
      includeTransactions: true,
    })

    if (block === null) {
      throw new Error(`[${this.chainId}] Block with hash ${hash} not found`)
    }

    return asSerializable<typeof block>({ ...block, timestamp: reliableTimestamp(block) })
  }

  async getBlockWithLogs(hash: string): Promise<BlockWithLogs> {
    const block = await this.#client.getBlock<true>({
      blockHash: hash as HexString,
      includeTransactions: true,
    })

    if (block === null) {
      throw new Error(`[${this.chainId}] Block with hash ${hash} not found`)
    }

    // We use {fromBlock,toBlock} for maximum compatibility.
    // Some RPCs doesn't support by block hash.
    const logs = await this.#client.getLogs({
      fromBlock: block.number,
      toBlock: block.number,
    })

    const blockWithLogs = {
      ...asSerializable<typeof block>({ ...block, timestamp: reliableTimestamp(block) }),
      logs: asSerializable<typeof logs>(logs),
    }
    return blockWithLogs as BlockWithLogs
  }

  async getTransactionReceipt(txHash: HexString): Promise<TransactionReceipt> {
    return await this.#client.getTransactionReceipt({ hash: txHash })
  }

  async multiCall(args: MulticallParameters): Promise<MulticallReturnType> {
    return await this.#client.multicall(args)
  }

  getNetworkInfo() {
    return this.#client.chain
  }
}

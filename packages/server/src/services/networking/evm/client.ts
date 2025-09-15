import { Observable } from 'rxjs'
import { http, PublicClient, Transport, createPublicClient, fallback, webSocket } from 'viem'
import * as viemChains from 'viem/chains'

import { HexString } from '@/lib.js'
import { Logger } from '@/services/types.js'
import { ApiClient, Finality, NeutralHeader } from '../types.js'
import { BlockWithLogs } from './types.js'

// TODO: move to config
const defaultConfirmations: Record<string, number> = {
  ethereum: 1, // Rationale: Waiting for 1–2 confirmations is enough for monitoring; full "epoch finality" is overkill.
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
  if (!chainId.startsWith('urn:ocn:evm:')) {
    throw new Error(
      `Malformed EVM chain identifier: ${chainId}. Expected format: 'urn:ocn:evm:{viem-chain-name|chain-id}'`,
    )
  }

  const chainValue = chainId.substring(12)

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

export class EvmApi implements ApiClient {
  readonly chainId: string

  readonly #log: Logger
  readonly #client: PublicClient<Transport, viemChains.Chain>
  readonly #unwatches: Set<() => void> = new Set()

  constructor(log: Logger, chainId: string, url: string | string[]) {
    this.chainId = chainId

    this.#log = log

    const endpoints = Array.isArray(url) ? url : [url]

    this.#client = createPublicClient<Transport, viemChains.Chain>({
      chain: resolveChain(chainId),
      transport: fallback(endpoints.map(asTransport)),
    })
  }

  async connect(): Promise<ApiClient> {
    this.#log.info('[%s] connected', this.chainId)
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
   * Subscribe to new finalized blocks for monitoring purposes.
   *
   * This observable emits blocks according to the requested finality:
   *
   * - 'new': emits blocks immediately, without waiting for confirmations.
   * - 'finalized': waits for a configurable number of confirmations to reduce the risk
   *   of short reorgs on chains like Ethereum mainnet.
   *
   * Reorg Handling:
   * - Short reorgs at the chain tip can occur, e.g., 1–2 blocks on Ethereum L1.
   * - We maintain a buffer of recent blocks to ensure only blocks that have reached
   *   the required confirmation threshold are emitted as finalized.
   * - If a new block's parent does not match the last emitted block, a short reorg
   *   is detected. Blocks in the buffer beyond the fork point are discarded to avoid
   *   emitting stale/forked data.
   *
   * Rationale on Finality:
   * - We do **not** wait for epoch-based finality (like L1 checkpoints or L2 fraud-proof windows),
   *   because for monitoring purposes this would introduce unnecessary delay.
   * - On L2s like Optimism or Arbitrum, sequencer blocks are effectively final immediately.
   * - On PoS chains like Polygon, the probability of short reorgs is extremely low; a small
   *   confirmation threshold (0–1) is sufficient for monitoring.
   * - Ethereum L1 still uses 1–2 confirmations to handle rare short reorgs safely.
   *
   * Overall:
   * - This method provides a **practical trade-off between immediacy and safety**.
   * - It ensures reorgs are correctly handled at the tip without waiting for epoch-level finality,
   *   making it suitable for monitoring live chain activity.
   *
   * @param finality - Finality preference ('new' emits immediately, 'finalized' waits for confirmations)
   * @param confirmationsOverride - optional number of confirmations to use instead of default for chain
   */
  followHeads$(finality: Finality, confirmationsOverride?: number): Observable<NeutralHeader> {
    const chainName = ((this.#client.chain as any).name as string).toLowerCase()
    const confirmations =
      finality === 'finalized' ? (confirmationsOverride ?? defaultConfirmations[chainName] ?? 12) : 0

    const buffer: NeutralHeader[] = []
    let lastEmittedBlock: NeutralHeader | null = null
    let lastSeenHeight: number | null = null
    let lastSeenHash: string | null = null

    return new Observable<NeutralHeader>((subscriber) => {
      try {
        const unwatch = this.#client.watchBlocks({
          onBlock: async (block) => {
            try {
              const header: NeutralHeader = {
                hash: block.hash!,
                height: Number(block.number),
                parenthash: block.parentHash!,
                status: finality,
              }

              // Skip duplicates
              if (lastSeenHash === header.hash) {
                return
              }
              lastSeenHash = header.hash

              // Detect gap
              if (lastSeenHeight !== null && header.height > lastSeenHeight + 1) {
                const gapStart = lastSeenHeight + 1
                const gapEnd = header.height - 1

                for (let h = gapStart; h <= gapEnd; h++) {
                  const missedBlock = await this.#client.getBlock({ blockNumber: BigInt(h) })
                  const missedHeader: NeutralHeader = {
                    hash: missedBlock.hash!,
                    height: Number(missedBlock.number),
                    parenthash: missedBlock.parentHash!,
                    status: finality,
                  }
                  buffer.push(missedHeader)
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

  async getBlockWithLogs(hash: string): Promise<BlockWithLogs> {
    const block = await this.#client.getBlock({
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

    return { ...block, logs }
  }

  getNetworkInfo() {
    return this.#client.chain
  }
}

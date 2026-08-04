import { filter, firstValueFrom, mergeMap, Observable, Subject, Subscription, share, toArray } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { AggregatedPriceData } from '@/services/agents/ticker/types.js'
import {
  Block,
  BlockEvent,
  extractEvents,
  storageEntriesAtLatest$,
} from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Logger } from '@/services/types.js'
import { chunk } from '../../../common.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import { DefiEventPayload, DefiLiquidityPayload, DefiSubscriptionPayload } from '../../../types.js'
import { CHAIN_ID } from '../common.js'
import { AcalaDexReservesValue, AcalaDexSwapEvent, AcalaPool, TokenId } from './types.js'

const ACALA_DEX_PROTOCOL = 'dex'
const DEX_ACC_ID = '0x6d6f646c6163612f6465786d0000000000000000000000000000000000000000'
const MAX_BATCH_SIZE = 50
const EXTERNAL_PRICE_SYMBOLS = new Set(['ACA', 'DOT'])

function mapTokenId(tid: TokenId): string {
  if (typeof tid === 'object' && (tid.type === 'Token' || tid.type === 'LiquidCrowdloan')) {
    return toMelbourne({
      type: 'NativeAssetId',
      value: structuredClone(tid),
    })
  }

  if (typeof tid === 'object' && tid.type === 'ForeignAsset') {
    return toMelbourne({
      ...tid,
      type: 'ForeignAssetId',
    })
  }

  return toMelbourne(tid)
}

function formatReserve(reserve: bigint, decimals: number): number {
  return Number(reserve) / Math.pow(10, decimals)
}

function toMarketId(tokenId0: string | TokenId, tokenId1: string | TokenId): string {
  const tid0 = typeof tokenId0 === 'string' ? tokenId0 : mapTokenId(tokenId0)
  const tid1 = typeof tokenId1 === 'string' ? tokenId1 : mapTokenId(tokenId1)

  // Sort lexicographically so marketId is identical regardless of swap direction
  const [first, second] = tid0 < tid1 ? [tid0, tid1] : [tid1, tid0]

  return `${DEX_ACC_ID}_${first}-${second}`
}

function calculateMedian(prices: number[]): number {
  if (prices.length === 0) {
    return 0
  }
  const sorted = [...prices].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function createAcalaDexProcessor({
  logger,
  ingress,
  fetchAssetMetadata,
  fetchPrices,
  subject,
}: {
  logger: Logger
  ingress: SubstrateIngressConsumer
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>
  fetchPrices: (assets: string[]) => Promise<AggregatedPriceData[]>
  subject: Subject<DefiSubscriptionPayload>
}) {
  const processorId = 'defi:acala-dex'
  const subs: Subscription[] = []
  const metadataMap = new Map<string, { symbol: string; decimals: number }>()
  const poolMap = new Map<string, AcalaPool>()
  const priceMap = new Map<string, number>()

  async function updateReserves(block?: Block) {
    try {
      const dexPoolEntries = await firstValueFrom(
        storageEntriesAtLatest$<[[TokenId, TokenId]], AcalaDexReservesValue>(
          ingress,
          CHAIN_ID,
          'Dex',
          'LiquidityPool',
        ).pipe(toArray()),
      )

      const uniqueTokenIds = Array.from(new Set(dexPoolEntries.flatMap(({ key }) => key[0].map(mapTokenId))))

      const assetMetadataList = await Promise.all(
        chunk(uniqueTokenIds, MAX_BATCH_SIZE).map((batch) => fetchAssetMetadata(batch)),
      ).then((results) => results.flat())

      assetMetadataList.forEach((meta) => {
        if (meta.decimals !== undefined) {
          metadataMap.set(toMelbourne(meta.id), { decimals: meta.decimals, symbol: meta.symbol ?? '??' })
        }
      })

      poolMap.clear()
      priceMap.clear()

      for (const { key, value } of dexPoolEntries) {
        const [tokenKey0, tokenKey1] = key[0].map(mapTokenId)
        const [reserve0, reserve1] = value

        const meta0 = metadataMap.get(tokenKey0)
        const meta1 = metadataMap.get(tokenKey1)

        if (!meta0 || !meta1) {
          continue
        }

        poolMap.set(toMarketId(tokenKey0, tokenKey1), {
          token0: {
            id: tokenKey0,
            symbol: meta0.symbol,
            decimals: meta0.decimals,
            reserve: reserve0,
          },
          token1: {
            id: tokenKey1,
            symbol: meta1.symbol,
            decimals: meta1.decimals,
            reserve: reserve1,
          },
        })
      }

      const pools = [...poolMap.values()]

      priceMap.clear()

      const externalPrices = await fetchPrices(['ACA', 'DOT'])

      const priceACA = externalPrices.find((p) => p.ticker === 'ACA')?.medianPrice
      const priceDOT = externalPrices.find((p) => p.ticker === 'DOT')?.medianPrice

      for (const pool of pools) {
        if (pool.token0.symbol === 'ACA' && priceACA !== undefined) {
          priceMap.set(pool.token0.id, priceACA)
        }

        if (pool.token1.symbol === 'ACA' && priceACA !== undefined) {
          priceMap.set(pool.token1.id, priceACA)
        }

        if (pool.token0.symbol === 'DOT' && priceDOT !== undefined) {
          priceMap.set(pool.token0.id, priceDOT)
        }

        if (pool.token1.symbol === 'DOT' && priceDOT !== undefined) {
          priceMap.set(pool.token1.id, priceDOT)
        }
      }

      const addSample = (samples: Map<string, number[]>, assetId: string, price: number) => {
        if (!Number.isFinite(price) || price <= 0) {
          return
        }

        if (!samples.has(assetId)) {
          samples.set(assetId, [])
        }

        samples.get(assetId)!.push(price)
      }

      let iterations = 0
      let changed = true

      const MAX_ITERATIONS = 20
      const EPSILON = 1e-6

      while (changed && iterations < MAX_ITERATIONS) {
        iterations++
        changed = false

        const samples = new Map<string, number[]>()

        for (const pool of pools) {
          if (pool.token0.decimals === undefined || pool.token1.decimals === undefined) {
            continue
          }

          const reserve0 = formatReserve(pool.token0.reserve, pool.token0.decimals)
          const reserve1 = formatReserve(pool.token1.reserve, pool.token1.decimals)

          if (reserve0 <= 0 || reserve1 <= 0) {
            continue
          }

          const price0 = priceMap.get(pool.token0.id)
          const price1 = priceMap.get(pool.token1.id)

          const token0Fixed =
            pool.token0.symbol !== undefined && EXTERNAL_PRICE_SYMBOLS.has(pool.token0.symbol)

          const token1Fixed =
            pool.token1.symbol !== undefined && EXTERNAL_PRICE_SYMBOLS.has(pool.token1.symbol)

          if (price0 !== undefined && !token1Fixed) {
            addSample(samples, pool.token1.id, (reserve0 * price0) / reserve1)
          }

          if (price1 !== undefined && !token0Fixed) {
            addSample(samples, pool.token0.id, (reserve1 * price1) / reserve0)
          }
        }

        for (const [assetId, assetSamples] of samples) {
          const median = calculateMedian(assetSamples)
          const previous = priceMap.get(assetId)

          if (previous === undefined || Math.abs(previous - median) / previous > EPSILON) {
            priceMap.set(assetId, median)
            changed = true
          }
        }
      }

      for (const [marketId, pool] of poolMap) {
        if (pool.token0.decimals === undefined || pool.token1.decimals === undefined) {
          continue
        }

        const price0 = priceMap.get(pool.token0.id)
        const price1 = priceMap.get(pool.token1.id)

        if (price0 === undefined || price1 === undefined) {
          logger.warn('[%s] No price found for pool tokens %s', processorId, marketId)
          continue
        }

        const r0 = formatReserve(pool.token0.reserve, pool.token0.decimals)
        const r1 = formatReserve(pool.token1.reserve, pool.token1.decimals)

        const suppliedUSD = r0 * price0 + r1 * price1

        const payload: DefiLiquidityPayload = {
          type: 'liquidity',
          category: 'exchange',
          networkId: CHAIN_ID,
          protocol: 'acala-dex',
          marketId,
          suppliedUSD,
          assets: [
            {
              assetId: toAssetId(CHAIN_ID, pool.token0.id),
              symbol: pool.token0.symbol ?? pool.token0.id,
              decimals: pool.token0.decimals,
              priceUSD: price0,
              balances: {
                reserves: pool.token0.reserve.toString(),
                total: pool.token0.reserve.toString(),
              },
            },
            {
              assetId: toAssetId(CHAIN_ID, pool.token1.id),
              symbol: pool.token1.symbol ?? pool.token1.id,
              decimals: pool.token1.decimals,
              priceUSD: price1,
              balances: {
                reserves: pool.token1.reserve.toString(),
                total: pool.token1.reserve.toString(),
              },
            },
          ],
        }

        subject.next(payload)
      }
    } catch (e) {
      if (block) {
        logger.error(e, '[%s] Error updating reserves at block %s #%s', processorId, block.hash, block.number)
      } else {
        logger.error(e, '[%s] Error updating reserves on initialise.', processorId)
      }
    }
  }

  function createDefiEventPayload(event: BlockEvent): DefiEventPayload[] {
    const payloads: DefiEventPayload[] = []

    try {
      if (event.name.toLowerCase() === 'swap') {
        const { trader, path, liquidity_changes } = event.value as AcalaDexSwapEvent

        if (path.length < 2 || liquidity_changes.length !== path.length) {
          logger.warn(
            '[%s] Invalid swap path or liquidity length (%s #%s)',
            processorId,
            event.blockHash,
            event.blockNumber,
          )
          return payloads
        }

        // Loop through every leg of the path
        for (let i = 0; i < path.length - 1; i++) {
          const tokenIdIn = mapTokenId(path[i])
          const tokenIdOut = mapTokenId(path[i + 1])

          const amountIn = liquidity_changes[i]
          const amountOut = liquidity_changes[i + 1]

          const metaIn = metadataMap.get(tokenIdIn)
          const metaOut = metadataMap.get(tokenIdOut)

          if (!metaIn || !metaOut) {
            logger.warn(
              '[%s] Missing metadata for swap leg %s -> %s (%s #%s)',
              processorId,
              tokenIdIn,
              tokenIdOut,
              event.blockHash,
              event.blockNumber,
            )
            continue
          }

          const normalizedIn = formatUnits(amountIn, metaIn.decimals)
          const normalizedOut = formatUnits(amountOut, metaOut.decimals)
          const priceIn = priceMap.get(tokenIdIn)
          const priceOut = priceMap.get(tokenIdOut)

          payloads.push({
            id: ulid(),
            type: 'event',
            networkId: CHAIN_ID,
            name: 'swap',
            protocol: ACALA_DEX_PROTOCOL,
            blockHash: event.blockHash,
            blockNumber: event.blockNumber.toString(),
            marketId: toMarketId(tokenIdIn, tokenIdOut),
            txHash: event.extrinsic?.hash ?? null,
            data: {
              origin: asPublicKey(trader),
              in: {
                assetId: toAssetId(CHAIN_ID, tokenIdIn),
                symbol: metaIn.symbol,
                amount: normalizedIn,
                amountUSD: priceIn ? priceIn * Number(normalizedIn) : undefined,
              },
              out: {
                assetId: toAssetId(CHAIN_ID, tokenIdOut),
                symbol: metaOut.symbol,
                amount: normalizedOut,
                amountUSD: priceOut ? priceOut * Number(normalizedOut) : undefined,
              },
            },
          })
        }
      } else {
        logger.info(
          '[%s] Unsupported dex event %s (%s #%s)',
          processorId,
          event.name,
          event.blockHash,
          event.blockNumber,
        )
      }
    } catch (e) {
      logger.error(
        e,
        '[%s] Error processing event #%s-%s (blockHash=%s)',
        processorId,
        event.blockNumber,
        event.blockPosition,
        event.blockHash,
      )
    }

    return payloads
  }

  function watchEvents() {
    return (source$: Observable<BlockEvent>): Observable<DefiEventPayload> =>
      source$.pipe(
        filter((e) => e.module.toLowerCase() === ACALA_DEX_PROTOCOL),
        mergeMap((event) => createDefiEventPayload(event)),
      )
  }

  async function start(block$: Observable<Block>) {
    await updateReserves()
    const events$ = block$.pipe(extractEvents(), watchEvents(), share())

    // Events
    subs.push(events$.subscribe((payload) => subject.next(payload)))

    // Liquidity
    subs.push(
      block$
        .pipe(
          smartTrigger<Block>({
            events$,
            maxStaleBlocks: 100,
          }),
        )
        .subscribe(updateReserves),
    )

    logger.info('[%s] Processor started.', processorId)
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0

    logger.info('[%s] Processor stopped.', processorId)
  }

  return {
    start,
    stop,
  }
}

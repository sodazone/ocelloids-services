import { filter, firstValueFrom, map, Observable, Subject, Subscription, share, toArray } from 'rxjs'
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
import { AcalaDexReservesValue, TokenId } from './types.js'

const ACALA_DEX_PROTOCOL = 'dex'
const DEX_ACC_ID = '0x6d6f646c6163612f6465786d0000000000000000000000000000000000000000'
const MAX_BATCH_SIZE = 50

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
  const subs: Subscription[] = []

  async function updateReserves() {
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

    const metadataMap = new Map<string, AssetMetadata>(
      assetMetadataList.map((meta) => [toMelbourne(meta.id), meta]),
    )

    const pools = dexPoolEntries.map(({ key, value }) => {
      const [tokenKey0, tokenKey1] = key[0].map(mapTokenId)
      const [reserve0, reserve1] = value
      const meta0 = metadataMap.get(tokenKey0)
      const meta1 = metadataMap.get(tokenKey1)

      return {
        token0: {
          id: tokenKey0,
          symbol: meta0?.symbol,
          decimals: meta0?.decimals,
          reserve: reserve0,
        },
        token1: {
          id: tokenKey1,
          symbol: meta1?.symbol,
          decimals: meta1?.decimals,
          reserve: reserve1,
        },
      }
    })

    const externalPrices = await fetchPrices(['ACA', 'DOT'])
    const priceACA = externalPrices.find((p) => p.ticker === 'ACA')?.medianPrice
    const priceDOT = externalPrices.find((p) => p.ticker === 'DOT')?.medianPrice

    const FIXED_EXTERNAL_SYMBOLS = new Set(['ACA', 'DOT'])

    const finalPrices = new Map<string, number>()

    const poolPriceSamples = new Map<string, number[]>()

    const addSample = (assetId: string, price: number) => {
      if (!poolPriceSamples.has(assetId)) {
        poolPriceSamples.set(assetId, [])
      }
      poolPriceSamples.get(assetId)!.push(price)
    }

    for (const pool of pools) {
      if (pool.token0.symbol === 'ACA' && priceACA !== undefined) {
        finalPrices.set(pool.token0.id, priceACA)
      }
      if (pool.token1.symbol === 'ACA' && priceACA !== undefined) {
        finalPrices.set(pool.token1.id, priceACA)
      }
      if (pool.token0.symbol === 'DOT' && priceDOT !== undefined) {
        finalPrices.set(pool.token0.id, priceDOT)
      }
      if (pool.token1.symbol === 'DOT' && priceDOT !== undefined) {
        finalPrices.set(pool.token1.id, priceDOT)
      }
    }

    let newPriceDiscovered = true
    let iterations = 0
    const maxIterations = pools.length

    while (newPriceDiscovered && iterations < maxIterations) {
      newPriceDiscovered = false
      iterations++

      for (const pool of pools) {
        if (pool.token0.decimals === undefined || pool.token1.decimals === undefined) {
          continue
        }

        const p0 = finalPrices.get(pool.token0.id)
        const p1 = finalPrices.get(pool.token1.id)

        const r0 = formatReserve(pool.token0.reserve, pool.token0.decimals)
        const r1 = formatReserve(pool.token1.reserve, pool.token1.decimals)

        if (r0 <= 0 || r1 <= 0) {
          continue
        }

        const isToken0Fixed = pool.token0.symbol && FIXED_EXTERNAL_SYMBOLS.has(pool.token0.symbol)
        const isToken1Fixed = pool.token1.symbol && FIXED_EXTERNAL_SYMBOLS.has(pool.token1.symbol)

        if (p0 !== undefined && !isToken1Fixed) {
          const derivedPrice1 = (r0 * p0) / r1
          addSample(pool.token1.id, derivedPrice1)
        }

        if (p1 !== undefined && !isToken0Fixed) {
          const derivedPrice0 = (r1 * p1) / r0
          addSample(pool.token0.id, derivedPrice0)
        }
      }

      for (const [assetId, samples] of poolPriceSamples.entries()) {
        if (!finalPrices.has(assetId) && samples.length > 0) {
          const meanPrice = samples.reduce((a, b) => a + b, 0) / samples.length
          finalPrices.set(assetId, meanPrice)
          newPriceDiscovered = true
        }
      }
    }

    for (const pool of pools) {
      if (pool.token0.decimals === undefined || pool.token1.decimals === undefined) {
        continue
      }

      const price0 = finalPrices.get(pool.token0.id) ?? 0
      const price1 = finalPrices.get(pool.token1.id) ?? 0

      const r0 = formatReserve(pool.token0.reserve, pool.token0.decimals)
      const r1 = formatReserve(pool.token1.reserve, pool.token1.decimals)

      const suppliedUSD = r0 * price0 + r1 * price1

      const payload: DefiLiquidityPayload = {
        type: 'liquidity',
        category: 'exchange',
        networkId: CHAIN_ID,
        protocol: 'acala-dex',
        marketId: `${DEX_ACC_ID}_${pool.token0.id}-${pool.token1.id}`,
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
  }

  function createDefiEventPayload(event: BlockEvent): DefiEventPayload | null {
    return null
  }

  function watchEvents() {
    return (source$: Observable<BlockEvent>): Observable<DefiEventPayload> =>
      source$.pipe(
        filter((e) => e.module.toLowerCase() === ACALA_DEX_PROTOCOL),
        map((event) => createDefiEventPayload(event)),
        filter((payload): payload is DefiEventPayload => payload !== null),
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
            maxStaleBlocks: 1_000,
          }),
        )
        .subscribe(updateReserves),
    )

    logger.info('[defi:acala-dex] Processor started.')
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0

    logger.info('[defi:acala-dex] Processor stopped.')
  }

  return {
    start,
    stop,
  }
}

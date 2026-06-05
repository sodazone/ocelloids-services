import { filter, map, Observable, Subject, Subscription, share } from 'rxjs'
import { ulid } from 'ulidx'
import { Abi, formatUnits } from 'viem'
import { NetworkURN } from '@/lib.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { Logger } from '@/services/types.js'
import poolAbi from '../../../protocols/algebra/abis/pool.json' with { type: 'json' }
import { smartTrigger } from '../../../rxjs/trigger.js'
import type { DefiEventPayload, DefiPricePayload, DefiSubscriptionPayload } from '../../../types.js'
import { algebraPools, tokens } from './definitions.js'
import { computeUSDPrices } from './pricing.js'
import { BurnEventArgs, MintEventArgs, PriceEdge, SwapEventArgs } from './types.js'

const PROTOCOL = 'stellaswap-v4'
const PRICE_EMISSION_THRESHOLD = 0.0001

export function createStellaswapProcessor({
  logger,
  chainId,
  assetChainId,
  ingress,
  subject,
}: {
  logger: Logger
  chainId: NetworkURN
  assetChainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<DefiSubscriptionPayload>
}) {
  const Q96 = 2n ** 96n

  const poolAddresses = algebraPools.map((p) => p.address)
  const poolLookup = new Map(algebraPools.map((p) => [p.address.toLowerCase(), p]))
  const prices: Map<string, number> = new Map()

  const subs: Subscription[] = []

  const sqrtPriceX96ToPrice = (sqrtPriceX96: bigint) =>
    Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96)

  const normalizePrice = (price: number, d0: number, d1: number) => price * 10 ** (d0 - d1)

  /**
   * Refreshes all market data and pushes to the subject
   */
  async function updateAllMarkets(blockNumber?: bigint) {
    const contracts = algebraPools.flatMap((pool) => [
      { address: pool.address, abi: poolAbi as Abi, functionName: 'globalState' },
      { address: pool.address, abi: poolAbi as Abi, functionName: 'liquidity' },
      { address: pool.address, abi: poolAbi as Abi, functionName: 'getReserves' },
    ])

    try {
      const results = await ingress.multicall(chainId, { contracts, blockNumber })

      const poolData = algebraPools
        .map((pool, i) => {
          const base = i * 3
          const [gs, liq, res] = [results[base], results[base + 1], results[base + 2]]

          if (gs.status !== 'success' || liq.status !== 'success' || res.status !== 'success') {
            return null
          }

          const globalState = gs.result as [bigint, number, number, number, boolean]
          const t0 = tokens[pool.token0]
          const t1 = tokens[pool.token1]

          const price = normalizePrice(sqrtPriceX96ToPrice(globalState[0]), t0.decimals, t1.decimals)

          return {
            pool,
            price,
            reserve0: formatUnits((res.result as bigint[])[0], t0.decimals),
            reserve1: formatUnits((res.result as bigint[])[1], t1.decimals),
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)

      const edges: PriceEdge[] = poolData.map((p) => ({
        from: p.pool.token0,
        to: p.pool.token1,
        price: p.price,
      }))
      const usdPrices = computeUSDPrices(edges)

      for (const p of poolData) {
        const priceUSD0 = usdPrices[p.pool.token0] || 0
        const priceUSD1 = usdPrices[p.pool.token1] || 0

        subject.next({
          type: 'liquidity',
          category: 'exchange',
          protocol: PROTOCOL,
          marketId: p.pool.address.toLowerCase(),
          networkId: chainId,
          suppliedUSD: Number(p.reserve0) * priceUSD0 + Number(p.reserve1) * priceUSD1,
          assets: [
            {
              assetId: toAssetId(assetChainId, tokens[p.pool.token0].address.toLowerCase()),
              symbol: p.pool.token0,
              decimals: tokens[p.pool.token0].decimals,
              priceUSD: priceUSD0,
              balances: { total: p.reserve0, reserves: p.reserve0 },
            },
            {
              assetId: toAssetId(assetChainId, tokens[p.pool.token1].address.toLowerCase()),
              symbol: p.pool.token1,
              decimals: tokens[p.pool.token1].decimals,
              priceUSD: priceUSD1,
              balances: { total: p.reserve1, reserves: p.reserve1 },
            },
          ],
        })
      }

      for (const [assetSymbol, price] of Object.entries(usdPrices)) {
        const prevPrice = prices.get(assetSymbol)

        if (prevPrice !== undefined) {
          const diff = Math.abs(price - prevPrice) / prevPrice
          if (diff < PRICE_EMISSION_THRESHOLD) {
            continue
          }
        }

        prices.set(assetSymbol, price)

        const tokenMeta = tokens[assetSymbol]
        if (!tokenMeta) {
          continue
        }
        subject.next({
          type: 'price',
          assetId: toAssetId(assetChainId, tokenMeta.address.toLowerCase()),
          decimals: tokenMeta.decimals,
          networkId: chainId,
          priceUSD: price.toString(),
          protocol: PROTOCOL,
          symbol: assetSymbol,
          updatedAt: Date.now(),
        })
      }
    } catch (err) {
      console.error('[defi:stellaswap] liquidity update failed', err)
    }
  }

  function extractPoolEvents() {
    return (source: Observable<BlockWithLogs>): Observable<DefiEventPayload> => {
      return source.pipe(
        filterLogs({ abi: poolAbi as Abi, addresses: poolAddresses }, ['Swap', 'Mint', 'Burn']),
        map((log) => {
          const pool = poolLookup.get(log.address.toLowerCase())
          if (!pool) {
            return null
          }

          const token0 = tokens[pool.token0]
          const token1 = tokens[pool.token1]
          const price0 = prices.get(pool.token0)
          const price1 = prices.get(pool.token1)

          const base = {
            type: 'event' as const,
            id: ulid(),
            marketId: log.address,
            protocol: PROTOCOL,
            networkId: chainId,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            txHash: log.transactionHash,
          }

          if (log.eventName === 'Swap') {
            const args = log.args as SwapEventArgs

            const a0 = BigInt(args.amount0)
            const a1 = BigInt(args.amount1)
            const isA0In = a0 > 0n

            const input = isA0In
              ? { amount: formatUnits(a0, token0.decimals), price: price0 }
              : { amount: formatUnits(a1, token1.decimals), price: price1 }

            const output = isA0In
              ? { amount: formatUnits(-a1, token1.decimals), price: price1 }
              : { amount: formatUnits(-a0, token0.decimals), price: price0 }

            const payload: DefiEventPayload = {
              ...base,
              name: 'swap',
              data: {
                origin: args.sender,
                in: {
                  assetId: toAssetId(assetChainId, (isA0In ? token0 : token1).address.toLowerCase()),
                  symbol: isA0In ? pool.token0 : pool.token1,
                  amount: input.amount,
                  amountUSD: input.price ? Number(input.amount) * input.price : undefined,
                },
                out: {
                  assetId: toAssetId(assetChainId, (isA0In ? token1 : token0).address.toLowerCase()),
                  symbol: isA0In ? pool.token1 : pool.token0,
                  amount: output.amount,
                  amountUSD: output.price ? Number(output.amount) * output.price : undefined,
                },
              },
            }
            return payload
          }

          const args = log.args as MintEventArgs | BurnEventArgs
          const normalized0 = formatUnits(BigInt(args.amount0), token0.decimals)
          const normalized1 = formatUnits(BigInt(args.amount1), token1.decimals)

          const payload: DefiEventPayload = {
            ...base,
            name: log.eventName?.toLowerCase() as 'mint' | 'burn',
            data: {
              provider: args.owner,
              assets: [
                {
                  assetId: toAssetId(assetChainId, token0.address.toLowerCase()),
                  symbol: pool.token0,
                  amount: normalized0,
                  amountUSD: price0 ? price0 * Number(normalized0) : undefined,
                },
                {
                  assetId: toAssetId(assetChainId, token1.address.toLowerCase()),
                  symbol: pool.token1,
                  amount: normalized1,
                  amountUSD: price1 ? price1 * Number(normalized1) : undefined,
                },
              ],
            },
          }
          return payload
        }),
        filter((p) => p !== null),
      )
    }
  }

  function start(blockWithLogs$: Observable<BlockWithLogs>, lastStoredPrices: DefiPricePayload[]) {
    for (const { priceUSD, symbol } of lastStoredPrices) {
      try {
        prices.set(symbol, Number(priceUSD))
      } catch (e) {
        logger.warn(e, '[defi:stellaswap] Unable to set last stored price on start for asset %s', symbol)
      }
    }

    const events$ = blockWithLogs$.pipe(extractPoolEvents(), share())

    // Event
    subs.push(events$.subscribe((payload) => subject.next(payload)))

    // Liquidity
    subs.push(
      blockWithLogs$
        .pipe(
          smartTrigger<BlockWithLogs>({
            events$,
            maxStaleBlocks: 1_000,
          }),
        )
        .subscribe((block) => updateAllMarkets(BigInt(block.number))),
    )
    logger.info('[defi:stellaswap] Processor started.')
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
  }
}

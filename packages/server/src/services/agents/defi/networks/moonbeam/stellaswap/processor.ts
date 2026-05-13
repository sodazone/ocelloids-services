import { filter, map, Observable, Subject, Subscription, share } from 'rxjs'
import { Abi, formatUnits } from 'viem'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import poolAbi from '../../../protocols/algebra/abis/pool.json' with { type: 'json' }
import { smartTrigger } from '../../../rxjs/trigger.js'
import { DefiEventPayload, DefiSubscriptionPayload } from '../../../types.js'
import { algebraPools, tokens } from './definitions.js'
import { computeUSDPrices } from './pricing.js'
import { BurnEventArgs, MintEventArgs, PriceEdge, SwapEventArgs } from './types.js'

export function createStellaswapProcessor({
  chainId,
  ingress,
  subject,
}: {
  chainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<DefiSubscriptionPayload>
}) {
  const Q96 = 2n ** 96n

  const poolAddresses = algebraPools.map((p) => p.address)
  const poolLookup = new Map(algebraPools.map((p) => [p.address.toLowerCase(), p]))

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
          protocol: 'stellaswap',
          marketId: p.pool.address,
          tvlUSD: Number(p.reserve0) * priceUSD0 + Number(p.reserve1) * priceUSD1,
          assets: [
            {
              assetId: tokens[p.pool.token0].address,
              symbol: p.pool.token0,
              decimals: tokens[p.pool.token0].decimals,
              priceUSD: priceUSD0,
              balances: { total: p.reserve0, reserves: p.reserve0 },
            },
            {
              assetId: tokens[p.pool.token1].address,
              symbol: p.pool.token1,
              decimals: tokens[p.pool.token1].decimals,
              priceUSD: priceUSD1,
              balances: { total: p.reserve1, reserves: p.reserve1 },
            },
          ],
        })
      }
    } catch (err) {
      console.error('[stellaswap] liquidity update failed', err)
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
          const base = {
            type: 'event' as const,
            marketId: log.address,
            protocol: 'stellaswap',
            networkId: chainId,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
          }

          if (log.eventName === 'Swap') {
            const args = log.args as SwapEventArgs
            const a0 = BigInt(args.amount0)
            const a1 = BigInt(args.amount1)

            const isA0In = a0 > 0n
            return {
              ...base,
              name: 'swap',
              data: {
                origin: args.sender,
                in: [
                  {
                    assetId: (isA0In ? token0 : token1).address,
                    symbol: isA0In ? pool.token0 : pool.token1,
                    amount: formatUnits(isA0In ? a0 : a1, (isA0In ? token0 : token1).decimals),
                  },
                ],
                out: [
                  {
                    assetId: (isA0In ? token1 : token0).address,
                    symbol: isA0In ? pool.token1 : pool.token0,
                    amount: formatUnits(isA0In ? -a1 : -a0, (isA0In ? token1 : token0).decimals),
                  },
                ],
              },
            } as DefiEventPayload
          }

          const args = log.args as MintEventArgs | BurnEventArgs
          return {
            ...base,
            name: log.eventName?.toLowerCase() as 'mint' | 'burn',
            data: {
              provider: args.owner,
              assets: [
                {
                  assetId: token0.address,
                  symbol: pool.token0,
                  amount: formatUnits(BigInt(args.amount0), token0.decimals),
                },
                {
                  assetId: token1.address,
                  symbol: pool.token1,
                  amount: formatUnits(BigInt(args.amount1), token1.decimals),
                },
              ],
            },
          } as DefiEventPayload
        }),
        filter((p): p is DefiEventPayload => p !== null),
      )
    }
  }

  function start(blockWithLogs$: Observable<BlockWithLogs>) {
    const events$ = blockWithLogs$.pipe(extractPoolEvents(), share())

    // Event
    subs.push(events$.subscribe((payload) => subject.next(payload)))

    // Liquidity
    subs.push(
      blockWithLogs$
        .pipe(
          smartTrigger({
            events$,
            maxStaleBlocks: 1_000,
          }),
        )
        .subscribe((block) => updateAllMarkets(BigInt(block.number))),
    )
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
  }
}

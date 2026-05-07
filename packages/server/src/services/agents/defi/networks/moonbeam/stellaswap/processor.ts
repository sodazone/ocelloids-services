import { filter, map, Observable, Subject, Subscription, scan, share } from 'rxjs'
import { Abi, formatUnits } from 'viem'
import { HexString, NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import poolAbi from '../../../protocols/algebra/abis/pool.json' with { type: 'json' }
import {
  DefiEventAsset,
  DefiEventPayload,
  DefiLiquidityPayload,
  DefiSubscriptionPayload,
} from '../../../types.js'
import { algebraPools, algebraPoolsMap, tokens } from './definitioins.js'
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
  const MAX_STALE_BLOCKS = 1_000
  const Q96 = 2n ** 96n
  const poolAddresses = algebraPools.map((p) => p.address)

  const subs: Subscription[] = []

  function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    const numerator = sqrtPriceX96 * sqrtPriceX96
    const denominator = Q96 * Q96
    return Number(numerator) / Number(denominator)
  }

  function normalizePrice(price: number, decimals0: number, decimals1: number) {
    return price * 10 ** (decimals0 - decimals1)
  }

  async function updatePoolData(blockNumber?: bigint) {
    // 1. Prepare Multicall
    const contracts = algebraPools.flatMap((pool) => [
      { address: pool.address, abi: poolAbi as Abi, functionName: 'globalState' },
      { address: pool.address, abi: poolAbi as Abi, functionName: 'liquidity' },
      { address: pool.address, abi: poolAbi as Abi, functionName: 'getReserves' },
    ])

    try {
      const results = await ingress.multicall(chainId, { contracts, blockNumber })

      // 2. Extract results and compute prices
      const poolData = Object.entries(algebraPoolsMap)
        .map(([pair, pool], i) => {
          const base = i * 3
          const [gs, liq, res] = [results[base], results[base + 1], results[base + 2]]

          if (gs.status !== 'success' || liq.status !== 'success' || res.status !== 'success') {
            return null
          }

          const globalState = gs.result as [bigint, number, number, number, boolean]
          const token0 = tokens[pool.token0]
          const token1 = tokens[pool.token1]

          const rawPrice = sqrtPriceX96ToPrice(globalState[0])
          const price = normalizePrice(rawPrice, token0.decimals, token1.decimals)

          return {
            pair,
            pool,
            price,
            reserve0: formatUnits((res.result as bigint[])[0], token0.decimals),
            reserve1: formatUnits((res.result as bigint[])[1], token1.decimals),
          }
        })
        .filter(Boolean)

      // 3. Pricing & USD Conversion
      const edges: PriceEdge[] = poolData.map((p) => ({
        from: p!.pool.token0,
        to: p!.pool.token1,
        price: p!.price,
      }))
      const usdPrices = computeUSDPrices(edges)

      // 4. Emit payloads
      for (const p of poolData) {
        if (!p) {
          continue
        }

        const priceUSD0 = usdPrices[p.pool.token0] || 0
        const priceUSD1 = usdPrices[p.pool.token1] || 0
        const tvlUSD = Number(p.reserve0) * priceUSD0 + Number(p.reserve1) * priceUSD1

        const payload: DefiLiquidityPayload = {
          type: 'liquidity',
          category: 'exchange',
          protocol: 'stellaswap',
          marketId: p.pool.address,
          tvlUSD,
          assets: [
            {
              assetId: tokens[p.pool.token0].address,
              symbol: p.pool.token0,
              decimals: tokens[p.pool.token0].decimals,
              priceUSD: priceUSD0,
              balances: { total: p.reserve0 },
            },
            {
              assetId: tokens[p.pool.token1].address,
              symbol: p.pool.token1,
              decimals: tokens[p.pool.token1].decimals,
              priceUSD: priceUSD1,
              balances: { total: p.reserve1 },
            },
          ],
        }
        subject.next(payload)
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
          const pool = algebraPools.find((c) => c.address === (log.address as HexString))

          if (pool === undefined) {
            console.log('Cannot resolve pool for event', log)
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

            // Determine which token was 'in' (positive) and 'out' (negative)
            // In Algebra/UniV3, amount0/1 are int256
            const assetsIn: DefiEventAsset[] = []
            const assetsOut: DefiEventAsset[] = []

            const amount0 = BigInt(args.amount0)
            const amount1 = BigInt(args.amount1)

            if (amount0 > 0n) {
              assetsIn.push({
                assetId: token0.address,
                symbol: pool.token0,
                amount: formatUnits(amount0, token0.decimals),
              })
              assetsOut.push({
                assetId: token1.address,
                symbol: pool.token1,
                amount: formatUnits(-amount1, token1.decimals),
              })
            } else {
              assetsIn.push({
                assetId: token1.address,
                symbol: pool.token1,
                amount: formatUnits(amount1, token1.decimals),
              })
              assetsOut.push({
                assetId: token0.address,
                symbol: pool.token0,
                amount: formatUnits(-amount0, token0.decimals),
              })
            }

            return {
              ...base,
              name: 'swap',
              data: { origin: args.sender, in: assetsIn, out: assetsOut },
            } as DefiEventPayload
          }

          // Generic Mint/Burn mapping
          const isMint = log.eventName === 'Mint'
          const args = isMint ? (log.args as MintEventArgs) : (log.args as BurnEventArgs)

          const amount0 = BigInt(args.amount0)
          const amount1 = BigInt(args.amount1)

          return {
            ...base,
            name: isMint ? 'mint' : 'burn',
            data: {
              provider: args.owner,
              assets: [
                {
                  assetId: token0.address,
                  symbol: pool.token0,
                  amount: formatUnits(amount0, token0.decimals),
                },
                {
                  assetId: token1.address,
                  symbol: pool.token1,
                  amount: formatUnits(amount1, token1.decimals),
                },
              ],
            },
          } as DefiEventPayload
        }),
        filter((payload): payload is DefiEventPayload => payload !== null),
      )
    }
  }

  function start(blockWithLogs$: Observable<BlockWithLogs>) {
    const events$ = blockWithLogs$.pipe(extractPoolEvents(), share())

    // 1. Subscription for real-time events
    subs.push(
      events$.subscribe({
        next: (payload) => subject.next(payload),
        error: (err) => console.error('[stellaswap] Event stream error', err),
      }),
    )

    // 2. Subscription for Liquidity Updates
    // we update if max stale blocks reached or there's a recent DeFi event
    subs.push(
      blockWithLogs$
        .pipe(
          scan(
            (acc, block) => {
              const hasEvent = block.logs.some((log) =>
                poolAddresses.includes(log.address.toLowerCase() as HexString),
              )

              const blocksSinceUpdate =
                acc.lastUpdateBlock === 0n ? MAX_STALE_BLOCKS : BigInt(block.number) - acc.lastUpdateBlock

              const shouldUpdate =
                acc.lastUpdateBlock === 0n || hasEvent || blocksSinceUpdate >= BigInt(MAX_STALE_BLOCKS)

              return {
                block,
                shouldUpdate,
                lastUpdateBlock: shouldUpdate ? BigInt(block.number) : acc.lastUpdateBlock,
              }
            },
            { block: null as any, shouldUpdate: false, lastUpdateBlock: 0n },
          ),
          filter((state) => state.shouldUpdate),
          map((state) => state.block),
        )
        .subscribe({
          next: (block) => updatePoolData(BigInt(block.number)),
          error: (err) => console.error('[stellaswap] Liquidity trigger error', err),
        }),
    )
  }

  return {
    start,
    stop: () => {
      for (const sub of subs) {
        sub.unsubscribe()
      }
    },
  }
}

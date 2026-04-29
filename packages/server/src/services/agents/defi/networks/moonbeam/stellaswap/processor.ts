import { filter, map, Observable, Subject, Subscription } from 'rxjs'
import { Abi } from 'viem'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { Block, BlockWithLogs } from '@/services/networking/evm/types.js'
import poolAbi from '../../../protocols/algebra/abis/pool.json' with { type: 'json' }
import { algebraPools, tokens } from './metadata.static.js'
import { computeUSDPrices } from './pricing.js'
import { PriceEdge } from './types.js'

export function createStellaswapProcessor({
  chainId,
  ingress,
  subject,
}: {
  chainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<any>
}) {
  const Q96 = 2n ** 96n
  const poolAddresses = Object.values(algebraPools).map((p) => p.address)

  const subs: Subscription[] = []

  function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    const numerator = sqrtPriceX96 * sqrtPriceX96
    const denominator = Q96 * Q96
    return Number(numerator) / Number(denominator)
  }

  function normalizePrice(price: number, decimals0: number, decimals1: number) {
    return price * 10 ** (decimals0 - decimals1)
  }

  function formatUnits(value: bigint, decimals: number) {
    return Number(value) / 10 ** decimals
  }

  async function updatePoolData(blockNumber?: bigint) {
    const poolResults: any[] = []
    const calls: any[] = []
    const poolEntries = Object.entries(algebraPools)

    for (const [, pool] of poolEntries) {
      calls.push(
        {
          address: pool.address,
          abi: poolAbi as Abi,
          functionName: 'globalState',
          blockNumber,
        },
        {
          address: pool.address,
          abi: poolAbi as Abi,
          functionName: 'liquidity',
          blockNumber,
        },
        {
          address: pool.address,
          abi: poolAbi as Abi,
          functionName: 'getReserves',
          blockNumber,
        },
      )
    }

    try {
      const results = await ingress.multicall(chainId, {
        contracts: calls,
        blockNumber,
      })

      // results are returned in same order as calls
      for (let i = 0; i < poolEntries.length; i++) {
        const [pair, pool] = poolEntries[i]

        const base = i * 3

        const globalStateResult = results[base]
        const liquidityResult = results[base + 1]
        const reservesResult = results[base + 2]

        if (
          globalStateResult.status !== 'success' ||
          liquidityResult.status !== 'success' ||
          reservesResult.status !== 'success'
        ) {
          console.error(`Failed reading pool ${pair}`, {
            globalStateResult,
            liquidityResult,
            reservesResult,
          })
          continue
        }

        const globalState = globalStateResult.result as [bigint, number, number, number, boolean]
        const liquidity = liquidityResult.result as bigint
        const reserves = reservesResult.result as [bigint, bigint]

        const sqrtPriceX96 = globalState[0]
        const tick = globalState[1]

        const token0 = tokens[pool.token0]
        const token1 = tokens[pool.token1]

        const rawPrice = sqrtPriceX96ToPrice(sqrtPriceX96)
        const price = normalizePrice(rawPrice, token0.decimals, token1.decimals)
        const priceInverse = 1 / price

        const reserve0 = formatUnits(reserves[0], token0.decimals)
        const reserve1 = formatUnits(reserves[1], token1.decimals)

        poolResults.push({
          chainId,
          pair,
          address: pool.address,
          token0: pool.token0,
          token1: pool.token1,
          price,
          priceInverse,
          tick,
          liquidity: BigInt(liquidity),
          reserve0,
          reserve1,
        })
      }
    } catch (err) {
      console.error('Multicall failed', err)
      return
    }

    const edges: PriceEdge[] = []

    for (const p of poolResults) {
      edges.push({
        from: p.token0,
        to: p.token1,
        price: p.price,
      })
    }

    const usdPrices = computeUSDPrices(edges)

    for (const token of Object.keys(tokens)) {
      if (!usdPrices[token]) {
        console.warn('NO USD PATH:', token)
      }
    }

    for (const p of poolResults) {
      const priceUSD_token0 = usdPrices[p.token0]
      const priceUSD_token1 = usdPrices[p.token1]

      const impliedPrice = priceUSD_token0 / priceUSD_token1
      const deviation = Math.abs(impliedPrice - p.price) / p.price

      const payload = {
        ...p,
        priceUSD_token0,
        priceUSD_token1,
        impliedPrice,
        deviation,
      }

      subject.next(payload)
      console.log(payload)
    }
  }

  function extractPoolEvents() {
    return (source: Observable<BlockWithLogs>): Observable<any> => {
      return source.pipe(
        filterLogs({ abi: poolAbi as Abi, addresses: poolAddresses }, ['Swap', 'Mint', 'Burn', 'Flash']),
        map((log) => {
          console.log(log.eventName, log)
          return null
        }),
        filter((ev) => ev !== null),
      )
    }
  }

  function start(blockWithLogs$: Observable<BlockWithLogs>) {
    subs.push(
      blockWithLogs$.subscribe((block: Block) => {
        console.log(block.number)
        //updatePoolData(BigInt(block.number))
      }),
    )

    subs.push(blockWithLogs$.pipe(extractPoolEvents()).subscribe())

    // XXX: for testing
    updatePoolData()
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

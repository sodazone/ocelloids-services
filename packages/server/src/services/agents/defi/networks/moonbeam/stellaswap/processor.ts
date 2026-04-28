import { Subject } from 'rxjs'
import { Abi } from 'viem'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { Block } from '@/services/networking/evm/types.js'
import poolStateAbi from '../../../protocols/algebra/abis/pool.json' with { type: 'json' }
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
  function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    const Q96 = 2n ** 96n
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
    const poolResults = []

    for (const [pair, pool] of Object.entries(algebraPools)) {
      try {
        const [globalState, liquidity, reserves] = await Promise.all([
          ingress.readContract(chainId, {
            address: pool.address,
            abi: poolStateAbi as Abi,
            functionName: 'globalState',
            blockNumber,
          }),
          ingress.readContract(chainId, {
            address: pool.address,
            abi: poolStateAbi as Abi,
            functionName: 'liquidity',
            blockNumber,
          }),
          ingress.readContract(chainId, {
            address: pool.address,
            abi: poolStateAbi as Abi,
            functionName: 'getReserves',
            blockNumber,
          }),
        ])

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
      } catch (err) {
        console.error(`Failed reading pool ${pair}`, err)
      }
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

      subject.next({
        ...p,
        priceUSD_token0,
        priceUSD_token1,
        impliedPrice,
        deviation,
      })

      // XXX: tmp log
      console.log({
        ...p,
        priceUSD_token0,
        priceUSD_token1,
        impliedPrice,
        deviation,
      })
    }
  }

  return {
    onBlock: (block: Block) => {
      updatePoolData(BigInt(block.number))
    },
    _update: updatePoolData,
  }
}

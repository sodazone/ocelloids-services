import { PriceEdge } from './types.js'

function _computePoolWeight(reserve0: number, reserve1: number, priceUSD0: number, priceUSD1: number) {
  if (!priceUSD0 || !priceUSD1) {
    return 0
  }

  const tvl = reserve0 * priceUSD0 + reserve1 * priceUSD1
  return tvl
}

const DEFAULT_ANCHOR = 'xcUSDC'

export function computeUSDPrices(edges: PriceEdge[], anchor = DEFAULT_ANCHOR) {
  const prices: Record<string, number> = {}
  const adjacency: Record<string, { to: string; price: number }[]> = {}

  for (const { from, to, price } of edges) {
    if (!price || price <= 0 || !isFinite(price)) {
      continue
    }

    if (!adjacency[from]) {
      adjacency[from] = []
    }
    if (!adjacency[to]) {
      adjacency[to] = []
    }

    adjacency[from].push({ to, price })
    adjacency[to].push({ to: from, price: 1 / price })
  }

  const queue: string[] = [anchor]
  const visited = new Set<string>([anchor])
  prices[anchor] = 1

  let head = 0
  while (head < queue.length) {
    const current = queue[head++]
    const currentPrice = prices[current]

    const neighbors = adjacency[current] || []
    for (const { to, price } of neighbors) {
      if (!visited.has(to)) {
        visited.add(to)
        prices[to] = currentPrice / price
        queue.push(to)
      }
    }
  }

  return prices
}

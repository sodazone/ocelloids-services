import { Edge, Path, Pool, PoolsGraph, StartNode } from './types.js'

function isEdge(obj: StartNode | Edge): obj is Edge {
  return 'poolType' in obj && 'pool' in obj
}

export function buildGraph(pools: Pool[]): PoolsGraph {
  const graph: PoolsGraph = new Map()

  for (const { type, address, tokens, isLowLiquidity } of pools) {
    const n = tokens.length

    for (let i = 0; i < n; i++) {
      const tokenIn = tokens[i].id

      for (let j = 0; j < n; j++) {
        if (i === j) {
          continue
        }

        const tokenOut = tokens[j].id

        let edges = graph.get(tokenIn)
        if (!edges) {
          edges = []
          graph.set(tokenIn, edges)
        }

        edges.push({
          poolType: type,
          pool: address,
          token: tokenOut,
          isLowLiquidity,
        })
      }
    }
  }

  for (const edges of graph.values()) {
    edges.sort((a, b) => {
      // high liquidity comes before low liquidity
      if (a.isLowLiquidity !== b.isLowLiquidity) {
        return a.isLowLiquidity ? 1 : -1
      }

      // if both have same liquidity status, deprioritize 'xyk'
      const aIsXyk = a.poolType === 'xyk'
      const bIsXyk = b.poolType === 'xyk'

      if (aIsXyk !== bIsXyk) {
        return aIsXyk ? 1 : -1
      }

      return 0
    })
  }

  return graph
}

function findShortestBestPaths(
  graph: PoolsGraph,
  start: number,
  end: number,
  maxHops = 10,
  limit = 3,
): Path[] {
  const queue: Path[] = [[{ token: start }]]
  const results: Path[] = []

  while (queue.length > 0 && results.length < limit) {
    const path = queue.shift()! // Get the oldest path (shortest)
    const current = path[path.length - 1]

    if (path.length - 1 >= maxHops) {
      continue
    }

    const neighbors = graph.get(current.token) || []
    for (const edge of neighbors) {
      // Cycle prevention
      if (path.some((p) => p.token === edge.token) && edge.token !== end) {
        continue
      }
      // Prevent swaps over several tokens of the same pool
      if (isEdge(current) && current.pool === edge.pool) {
        continue
      }

      const newPath: Path = [...path, { ...edge }]

      if (edge.token === end) {
        results.push(newPath)
        if (results.length >= limit) {
          return results
        }
      } else {
        queue.push(newPath)
      }
    }
  }

  return results
}

function getBestPath(paths: Path[]): Path | null {
  if (paths.length === 0) {
    return null
  }

  return paths.sort((a, b) => {
    // 1. Count XYK hops in each path
    const aXykCount = a.filter((step) => 'poolType' in step && step.poolType === 'xyk').length
    const bXykCount = b.filter((step) => 'poolType' in step && step.poolType === 'xyk').length

    if (aXykCount !== bXykCount) {
      return aXykCount - bXykCount // Fewer XYK hops wins
    }

    // 2. Shortest path (fewer hops) wins
    if (a.length !== b.length) {
      return a.length - b.length
    }

    // 3. Liquidity check
    const aLowLiq = a.some((step) => 'isLowLiquidity' in step && step.isLowLiquidity)
    const bLowLiq = b.some((step) => 'isLowLiquidity' in step && step.isLowLiquidity)

    if (aLowLiq !== bLowLiq) {
      return aLowLiq ? 1 : -1
    }

    return 0
  })[0]
}

export function getSwapPath(graph: PoolsGraph, start: number, end: number, maxLength?: number): Path | null {
  const paths = findShortestBestPaths(graph, start, end, maxLength)
  return getBestPath(paths)
}

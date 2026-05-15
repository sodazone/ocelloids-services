import { Edge, Path, Pool, PoolsGraph } from './types.js'

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
  maxHops = 5,
  limit = 2,
): Path[] {
  const queue: Path[] = [[{ token: start }]]
  const results: Path[] = []

  while (queue.length > 0 && results.length < limit) {
    const path = queue.shift()! // Get the oldest path (shortest)
    const current = path[path.length - 1].token

    if (path.length - 1 >= maxHops) {
      continue
    }

    const neighbors = graph.get(current) || []

    for (const edge of neighbors) {
      // Cycle prevention
      if (path.some((p) => p.token === edge.token) && edge.token !== end) {
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

function collapsePath(path: Path): Path {
  if (path.length <= 2) {
    return path
  }

  const collapsed: Path = [path[0]]

  for (let i = 1; i < path.length; i++) {
    const currentStep = path[i] as Edge
    const lastCollapsedStep = collapsed[collapsed.length - 1] as Edge

    // Check if we can collapse:
    // 1. Both this step and the previous recorded step must have a pool
    // 2. Both must be 'stableswap' or 'omnipool'
    // 3. Both must belong to the same pool address
    const canCollapse =
      lastCollapsedStep?.pool &&
      currentStep.pool === lastCollapsedStep.pool &&
      ((currentStep.poolType === 'stableswap' && lastCollapsedStep.poolType === 'stableswap') ||
        (currentStep.poolType === 'omnipool' && lastCollapsedStep.poolType === 'omnipool'))

    if (canCollapse) {
      collapsed[collapsed.length - 1] = {
        ...lastCollapsedStep,
        token: currentStep.token,
      }
    } else {
      collapsed.push(currentStep)
    }
  }

  return collapsed
}

export function getSwapPath(graph: PoolsGraph, start: number, end: number, maxLength = 5): Path | null {
  const paths = findShortestBestPaths(graph, start, end, maxLength)
  return getBestPath(paths.map(collapsePath))
}

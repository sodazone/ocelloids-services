import { Edge, Path, Pool, PoolsGraph } from './types.js'

export function buildGraph(pools: Pool[]): PoolsGraph {
  const graph = new Map()

  for (const { type, address, tokens } of pools) {
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
        })
      }
    }
  }

  return graph
}

// Returns all possible paths found with DFS
export function chartPaths(
  graph: PoolsGraph,
  start: number,
  end: number,
  maxLength = 4,
  path: Path = [{ token: start }],
): Path[] {
  const current = path[path.length - 1].token

  // ✅ reached target (at least 1 hop)
  if (current === end && path.length > 1) {
    return [path]
  }

  const hops = path.length - 1
  if (hops >= maxLength) {
    return []
  }

  if (!graph.has(current)) {
    return []
  }

  const paths: Path[] = []

  for (const edge of graph.get(current)!) {
    const nextToken = edge.token

    // prevent cycles (except allow reaching end)
    const alreadyVisited = path.some((p) => p.token === nextToken)
    if (alreadyVisited && nextToken !== end) {
      continue
    }

    const nextStep: Edge = {
      token: nextToken,
      pool: edge.pool,
      poolType: edge.poolType,
    }

    const subPaths = chartPaths(graph, nextToken, end, maxLength, [...path, nextStep] as Path)

    paths.push(...subPaths)
  }

  return paths
}

// Returns first full path found
export function chartPath(
  graph: PoolsGraph,
  start: number,
  end: number,
  maxLength = 4,
  path: Path = [{ token: start }],
): Path | null {
  const current = path[path.length - 1].token

  if (current === end && path.length > 1) {
    return path
  }

  const hops = path.length - 1
  if (hops >= maxLength) {
    return null
  }

  if (!graph.has(current)) {
    return null
  }

  for (const edge of graph.get(current)!) {
    const nextToken = edge.token

    // prevent cycles (allow ending at target)
    const alreadyVisited = path.some((p) => p.token === nextToken)
    if (alreadyVisited && nextToken !== end) {
      continue
    }

    const nextStep: Edge = {
      token: nextToken,
      pool: edge.pool,
      poolType: edge.poolType,
    }

    const result = chartPath(graph, nextToken, end, maxLength, [...path, nextStep] as Path)

    if (result) {
      return result
    }
  }

  return null
}

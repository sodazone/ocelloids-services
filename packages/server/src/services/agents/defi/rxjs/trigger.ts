import { filter, map, merge, Observable, OperatorFunction, scan } from 'rxjs'

type BlockLike = {
  number: number | string
}

/**
 * Triggers based on:
 * 1. The first block (Initial)
 * 2. An event emission (Activity)
 * 3. Max stale blocks (Safety)
 */
export function smartTrigger<TBlock extends BlockLike>({
  events$,
  maxStaleBlocks,
}: {
  events$: Observable<any>
  maxStaleBlocks: number
}): OperatorFunction<TBlock, TBlock> {
  return (block$: Observable<TBlock>) => {
    const activitySignal$ = events$.pipe(map(() => ({ type: 'ACTIVITY' as const })))
    const blockSignal$ = block$.pipe(map((block) => ({ type: 'BLOCK' as const, block })))

    return merge(activitySignal$, blockSignal$).pipe(
      scan(
        (acc, signal) => {
          const isInitial = acc.lastUpdateBlock === 0n
          let shouldUpdate = false
          let currentBlock = acc.block

          if (signal.type === 'BLOCK') {
            currentBlock = signal.block
            const blocksSinceUpdate = BigInt(currentBlock.number) - acc.lastUpdateBlock

            if (isInitial || blocksSinceUpdate >= BigInt(maxStaleBlocks)) {
              shouldUpdate = true
            }
          } else if (signal.type === 'ACTIVITY') {
            shouldUpdate = true
          }

          return {
            block: currentBlock,
            shouldUpdate,
            lastUpdateBlock: shouldUpdate && currentBlock ? BigInt(currentBlock.number) : acc.lastUpdateBlock,
          }
        },
        { block: null as TBlock | null, shouldUpdate: false, lastUpdateBlock: 0n },
      ),
      filter(
        (state): state is { block: TBlock; shouldUpdate: true; lastUpdateBlock: bigint } =>
          state.shouldUpdate && state.block !== null,
      ),
      map((state) => state.block),
    )
  }
}

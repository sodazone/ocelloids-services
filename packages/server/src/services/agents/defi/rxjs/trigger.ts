import { Observable, OperatorFunction, Subscription } from 'rxjs'

type BlockLike = {
  number: number | string
}

type EventLike = {
  blockNumber: string | null
}

/**
 * Emits a block when:
 * 1. it's the first block seen (initial)
 * 2. the block had activity, at most once per block (activity)
 * 3. maxStaleBlocks have passed since the last emission (safety)
 */
export function smartTrigger<TBlock extends BlockLike, TEvent extends EventLike>({
  events$,
  maxStaleBlocks,
}: {
  events$: Observable<TEvent>
  maxStaleBlocks: number
}): OperatorFunction<TBlock, TBlock> {
  return (block$) =>
    new Observable<TBlock>((subscriber) => {
      let latest: TBlock | null = null // newest block seen (only reference retained)
      let latestNumber = -1n
      let lastEmitted = -1n // block number of the last emission
      let pendingActivity = -1n // highest block number with activity not yet flushed

      const emit = (block: TBlock, n: bigint) => {
        lastEmitted = n
        subscriber.next(block)
      }

      const sub = new Subscription()

      sub.add(
        events$.subscribe({
          next: (event) => {
            const n = BigInt(event.blockNumber ?? -1n)

            // Already covered by an emission for this block (or a later one)
            if (n <= lastEmitted) {
              return
            }

            if (latest !== null && latestNumber >= n) {
              // The block signal came first: flush now, once.
              emit(latest, latestNumber)
            } else if (n > pendingActivity) {
              // Activity came first: flush when its block arrives.
              pendingActivity = n
            }
          },
          error: (err) => subscriber.error(err),
        }),
      )

      sub.add(
        block$.subscribe({
          next: (block) => {
            const n = BigInt(block.number)
            latest = block
            latestNumber = n

            const hasActivity = pendingActivity >= 0n && pendingActivity <= n

            if (lastEmitted < 0n || hasActivity || n - lastEmitted >= maxStaleBlocks) {
              if (hasActivity) {
                pendingActivity = -1n
              }
              emit(block, n)
            }
          },
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        }),
      )

      return sub
    })
}

import { Observable, Subject, Subscription, share } from 'rxjs'
import { Abi } from 'viem'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { createMoonwellDataFetcher, mTokenAbi } from '../../../protocols/moonwell/fetcher.js'
import { Market } from '../../../protocols/moonwell/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import { DefiSubscriptionPayload } from '../../../types.js'
import { defs } from './definitions.js'

export function createMoonwellProcessor({
  chainId,
  ingress,
  subject,
}: {
  chainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<DefiSubscriptionPayload>
}) {
  const subs: Subscription[] = []
  const fetcher = createMoonwellDataFetcher(chainId, ingress)

  const activeMarketEntries = Object.values(defs.markets).filter((m) => !('deprecated' in m))
  const marketAddresses = activeMarketEntries.map((m) => defs.tokens[m.marketToken].address)

  /**
   * Refreshes all market data and pushes to the subject
   */
  async function updateAllMarkets(blockNumber?: bigint) {
    try {
      const markets: Market[] = activeMarketEntries.map((m) => ({
        mToken: defs.tokens[m.marketToken],
        underlying: defs.tokens[m.underlyingToken],
      }))

      for (const market of markets) {
        const marketData = await fetcher.getMarketData(
          market,
          defs.contracts.oracle,
          defs.contracts.comptroller,
          blockNumber,
        )
        subject.next(marketData)
      }
    } catch (err) {
      console.error(`[moonwell] Failed update at block ${blockNumber}:`, err)
    }
  }

  function start(blockWithLogs$: Observable<BlockWithLogs>) {
    const events$ = blockWithLogs$.pipe(
      filterLogs({ abi: mTokenAbi as Abi, addresses: marketAddresses }, [
        'Mint',
        'Redeem',
        'Borrow',
        'RepayBorrow',
        'LiquidateBorrow',
        'AccrueInterest',
      ]),
      share(),
    )

    // Event
    subs.push(
      events$.subscribe({
        next: (log) => {
          // TODO: Map log to DefiEventPayload
          // subject.next(payload)
        },
      }),
    )

    // Liquidity
    subs.push(
      blockWithLogs$
        .pipe(
          smartTrigger({
            events$,
            maxStaleBlocks: 1_000,
          }),
        )
        .subscribe({
          next: (block) => updateAllMarkets(BigInt(block.number)),
          error: (err) => console.error('[moonwell] Trigger error:', err),
        }),
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

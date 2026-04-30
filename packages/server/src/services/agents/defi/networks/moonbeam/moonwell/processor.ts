import { Observable, Subject, Subscription } from 'rxjs'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { createMoonwellDataFetcher } from '../../../protocols/moonwell/fetcher.js'
import { Market } from '../../../protocols/moonwell/types.js'
import { defs } from './definitions.js'

export function createMoonwellProcessor({
  chainId,
  ingress,
  subject,
}: {
  chainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<any>
}) {
  const subs: Subscription[] = []
  const fetcher = createMoonwellDataFetcher(chainId, ingress)

  async function start(blockWithLogs$: Observable<BlockWithLogs>) {
    const markets: Market[] = []
    for (const market of Object.values(defs.markets)) {
      if ('deprecated' in market) {
        continue
      }
      markets.push({
        mToken: defs.tokens[market.marketToken],
        underlying: defs.tokens[market.underlyingToken],
      })
    }

    for (const market of markets) {
      const marketData = await fetcher.getMarketData(
        market,
        defs.contracts.oracle,
        defs.contracts.comptroller,
      )

      subject.next(marketData)
    }
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

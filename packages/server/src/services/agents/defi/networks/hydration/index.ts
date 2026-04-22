import { Subject, Subscription } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { createOmnipoolWatcher } from './omnipool.js'
import { Block } from '@/services/networking/substrate/types.js'

export function hydrationDexMonitor(ingress: SubstrateIngressConsumer) {
  const chainId = networks.hydration
  const omnipool = createOmnipoolWatcher(ingress)
  const subject = new Subject<any>()

  let sub: Subscription

  async function onBlock(block: Block) {
    const omnipoolReserves = await omnipool.getUpdatedPoolReserves()
  }

  function start() {
    const shared$ = SubstrateSharedStreams.instance(ingress)
    sub = shared$.blocks(chainId).subscribe(onBlock)
  }

  return {
    start,
    stop: () => {
      if (sub) {
        sub.unsubscribe()
      }
    },
    events$: subject.asObservable()
  }
}

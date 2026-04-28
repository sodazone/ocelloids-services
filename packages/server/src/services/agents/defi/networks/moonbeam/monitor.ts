import { Subject, Subscription } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { Block } from '@/services/networking/evm/types.js'
import { createStellaswapProcessor } from './stellaswap/index.js'

export function moonbeamDexMonitor(ingress: EvmIngressConsumer) {
  const chainId = networks.moonbeam_evm
  const subject = new Subject<any>()
  const processors = [createStellaswapProcessor({ chainId, ingress, subject })]

  let sub: Subscription

  function onBlock(block: Block) {
    for (const p of processors) {
      p.onBlock(block)
    }
  }

  function start() {
    const finalized$ = ingress.finalizedBlocks(chainId)
    sub = finalized$.subscribe(onBlock)

    // XXX: test
    for (const p of processors) {
      p._update()
    }
  }

  return {
    start,
    stop: () => {
      if (sub) {
        sub.unsubscribe()
      }
    },
    events$: subject.asObservable(),
  }
}

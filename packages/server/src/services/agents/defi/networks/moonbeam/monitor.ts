import { mergeMap, Subject, share } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { createStellaswapProcessor } from './stellaswap/index.js'

export function moonbeamDexMonitor(ingress: EvmIngressConsumer) {
  const chainId = networks.moonbeam_evm
  const subject = new Subject<any>()
  const processors = [createStellaswapProcessor({ chainId, ingress, subject })]

  function start() {
    const blockWithLogs$ = ingress.finalizedBlocks(chainId).pipe(
      mergeMap((block) =>
        ingress.getLogs(chainId, block.number).then((logs) => ({
          ...block,
          logs,
        })),
      ),
      share(),
    )

    for (const p of processors) {
      p.start(blockWithLogs$)
    }
  }

  return {
    start,
    stop: () => {
      for (const p of processors) {
        p.stop()
      }
    },
    events$: subject.asObservable(),
  }
}

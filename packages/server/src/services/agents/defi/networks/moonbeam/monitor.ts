import { mergeMap, Subject, share } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { Logger } from '@/services/types.js'
import { DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import { createMoonwellProcessor } from './moonwell/processor.js'
import { createStellaswapProcessor } from './stellaswap/index.js'

export function moonbeamDexMonitor(
  logger: Logger,
  ingress: EvmIngressConsumer,
  deps?: DefiMonitorDependencies,
) {
  const chainId = networks.moonbeam_evm
  const subject = new Subject<DefiSubscriptionPayload>()
  const ctx = { logger, chainId, assetChainId: networks.moonbeam, ingress, subject }
  const processors = [createMoonwellProcessor(ctx), createStellaswapProcessor(ctx)]

  async function start() {
    const blockWithLogs$ = ingress.finalizedBlocks(chainId).pipe(
      mergeMap((block) =>
        ingress.getLogs(chainId, block.number).then((logs) => ({
          ...block,
          logs,
        })),
      ),
      share(),
    )

    const lastStoredPrices = deps ? await deps.listLatestPrices(chainId) : []

    for (const p of processors) {
      p.start(blockWithLogs$, lastStoredPrices)
    }
  }

  return {
    start,
    stop: () => {
      for (const p of processors) {
        p.stop()
      }
    },
    chainId,
    config: {
      evm: true,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}

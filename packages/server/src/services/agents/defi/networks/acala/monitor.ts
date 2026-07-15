import { filter, Subject } from 'rxjs'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger } from '@/services/types.js'
import { DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID } from './common.js'
import { createHomaProcessor } from './liquid-staking/processor.js'

export function acalaDefiMonitor(logger: Logger, ingress: IngressConsumers, deps: DefiMonitorDependencies) {
  const fetchAssetMetadata = (assets: string[]) => deps.fetchAssetMetadata(CHAIN_ID, assets)
  const fetchPrices = (assets: string[]) => deps.fetchTickerPrices(CHAIN_ID, assets)

  const subject = new Subject<DefiSubscriptionPayload>()

  const ctx = {
    logger,
    ingress: ingress.substrate,
    fetchAssetMetadata,
    fetchPrices,
    subject,
  }
  const processors = [createHomaProcessor(ctx)]

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(ingress.substrate)
    const block$ = shared$.blocks(CHAIN_ID).pipe(filter((b) => b.ingestionMode !== 'backfill'))
    for (const processor of processors) {
      await processor.start(block$)
    }
  }

  return {
    start,
    stop: () => {
      processors.forEach((p) => p.stop())
    },
    chainId: CHAIN_ID,
    config: {
      evm: false,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}

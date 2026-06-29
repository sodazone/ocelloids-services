import { firstValueFrom, Subject, Subscription, toArray } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { storageEntriesAtLatest$, XcmLocation } from '@/services/networking/substrate/index.js'
import { Logger } from '@/services/types.js'
import { DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'

const CHAIN_ID = networks.assetHub

export function assethubDexMonitor(
  logger: Logger,
  _ingress: IngressConsumers,
  deps: DefiMonitorDependencies,
) {
  const subject = new Subject<DefiSubscriptionPayload>()
  const subs: Subscription[] = []
  const ingress = _ingress.substrate

  async function start() {
    const _poolEntries = await firstValueFrom(
      storageEntriesAtLatest$<[[XcmLocation, XcmLocation]], number>(
        ingress,
        CHAIN_ID,
        'AssetConversion',
        'Pools',
      ).pipe(toArray()),
    )
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
    chainId: CHAIN_ID,
    config: {
      evm: false,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}

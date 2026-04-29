import { Subject, Subscription } from 'rxjs'
import { Abi } from 'viem'
import { asJSON } from '@/common/util.js'
import { networks } from '@/services/agents/common/networks.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { AaveV3HydrationMainnet } from './config.js'
import { createOmnipoolWatcher } from './pools/omnipool.js'
import { createStableswapWatcher } from './pools/stableswap.js'
import { createAaveWatcher } from './pools/aave.js'

export function hydrationDexMonitor(ingress: IngressConsumers) {
  const substrateIngress = ingress.substrate
  const evmIngress = ingress.evm
  const chainId = networks.hydration
  const fetchBalances = hydrationBalancesFetcher(chainId, substrateIngress)
  const omnipool = createOmnipoolWatcher(substrateIngress, fetchBalances)
  const stableswaps = createStableswapWatcher(substrateIngress, fetchBalances)
  const aave = createAaveWatcher(substrateIngress, evmIngress)

  const subject = new Subject<any>()

  let sub: Subscription

  async function onBlock(block: Block) {
    if (block.number % 10 !== 0) {
      return
    }
    const omnipoolReserves = await omnipool.getUpdatedPoolReserves(block)
    const stableswapReserves = await stableswaps.getUpdatedPoolReserves(block)
    const aaveReserves = await aave.getUpdatedPoolReserves(block)
    console.log('OMNIPOOL ---------', omnipoolReserves[0].tokens)
    console.log(
      'STABLESWAP ---------',
      stableswapReserves.map((s) => ({ ...s, tokens: asJSON(s.tokens) })),
    )
    console.log('AAVE ---------', aaveReserves.map(a => ({...a, tokens: asJSON(a.tokens)})))
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(substrateIngress)
    sub = shared$.blocks(chainId).subscribe(onBlock)
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

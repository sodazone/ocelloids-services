import { Subject, Subscription } from 'rxjs'
import { DataSteward } from '@/services/agents/steward/agent.js'
import { hydrationBalancesFetcher } from '@/services/agents/steward/balances/mappers/hydration.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '@/services/agents/steward/types.js'
import { QueryParams, QueryResult } from '@/services/agents/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Block } from '@/services/networking/substrate/types.js'
import { DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID } from './consts.js'
import { createAaveWatcher } from './pools/aave.js'
import { createOmnipoolWatcher } from './pools/omnipool.js'
import { createStableswapWatcher } from './pools/stableswap.js'
import { createXykWatcher } from './pools/xyk.js'

export function hydrationDexMonitor(ingress: IngressConsumers, steward: DataSteward) {
  const fetchAssetMetadata = async (assets: string[]): Promise<AssetMetadata[]> => {
    const { items } = (await steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: CHAIN_ID,
            assets,
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    return items.map((i) => (isAssetMetadata(i) ? i : null)).filter((i) => i !== null)
  }

  const substrateIngress = ingress.substrate
  const evmIngress = ingress.evm

  const fetchBalances = hydrationBalancesFetcher(CHAIN_ID, substrateIngress)

  const omnipool = createOmnipoolWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const stableswaps = createStableswapWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)
  const aave = createAaveWatcher(substrateIngress, evmIngress, fetchAssetMetadata)
  const xyk = createXykWatcher(substrateIngress, fetchBalances, fetchAssetMetadata)

  const subject = new Subject<DefiSubscriptionPayload>()

  let sub: Subscription

  async function onBlock(block: Block) {
    if (block.number % 50 !== 0) {
      return
    }
    const _xykReserves = await xyk.getUpdatedPoolReserves(block)
    const _omnipoolReserves = await omnipool.getUpdatedPoolReserves(block)
    const _stableswapReserves = await stableswaps.getUpdatedPoolReserves(block)
    const _aaveReserves = await aave.getUpdatedPoolReserves(block)
  }

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(substrateIngress)
    sub = shared$.blocks(CHAIN_ID).subscribe(onBlock)
  }

  return {
    start,
    stop: () => {
      if (sub) {
        sub.unsubscribe()
      }
    },
    chainId: CHAIN_ID,
    events$: subject.asObservable(),
  }
}

import { Subject } from 'rxjs'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger } from '@/services/types.js'
import { DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import { CHAIN_ID } from './consts.js'
import { createLiquidStakingProcessor } from './liquid-staking/processor.js'

/**
 * In Bifrost to get staking proxy accounts: slpv2.DelegatorByStakingProtocolAndDelegatorIndex (GeneralXcmStaking, Token2:0, 1000)
 * In AssetHub to get staking amounts: staking.Ledger(accountId)
 * and balances: system.Account(accountId)
 *
 * Bifrost accounting of total DOT staked: VtokenMinting.TokenPool(arg)
 * VToken issuance: VtokenMinting.VtokenIssuance(arg)
 *
 * vtoken minted event: 	vtokenminting (Minted)
 * vtoken redeem success: 	vtokenminting (RedeemSuccess)
 */

export function bifrostDefiMonitor(logger: Logger, ingress: IngressConsumers, deps: DefiMonitorDependencies) {
  const fetchAssetMetadata = (assets: string[]) => deps.fetchAssetMetadata(CHAIN_ID, assets)
  const fetchPrices = (assets: string[]) => deps.fetchTickerPrices(CHAIN_ID, assets)

  const subject = new Subject<DefiSubscriptionPayload>()

  const ctx = {
    logger,
    ingress,
    fetchAssetMetadata,
    fetchPrices,
    subject,
  }
  const processors = [createLiquidStakingProcessor(ctx)]

  async function start() {
    const shared$ = SubstrateSharedStreams.instance(ingress.substrate)
    const block$ = shared$.blocks(CHAIN_ID)
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

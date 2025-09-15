import { NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Subscription } from 'rxjs'

export type BalancesSubscriptionMapper = (
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueJob,
) => Subscription[]

export type BalanceUpdateJob = () => Promise<void>
export type EnqueueJob = (key: string, job: BalanceUpdateJob) => void

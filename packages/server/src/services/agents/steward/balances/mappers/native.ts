import { NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { filter } from 'rxjs'
import { EnqueueJob } from '../types.js'

const BALANCES_PALLET_EVENTS = ['Burned', 'Deposit', 'Endowed', 'Minted', 'Transfer', 'Withdraw']

export function nativeBalancesMapper(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueJob,
) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return streams
    .blockEvents(chainId)
    .pipe(
      filter(
        (blockEvent) => blockEvent.module === 'Balances' && BALANCES_PALLET_EVENTS.includes(blockEvent.name),
      ),
    )
    .subscribe(({ name, value }) => {
      // fetch balance
      if (name === 'Transfer') {
        console.log(name, value)
        const { from, to } = value
        const keyFrom = `${chainId}:${from}:native`
        const keyTo = `${chainId}:${to}:native`
        enqueue(keyFrom, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200))
          console.log('Updated', keyFrom)
        })
        enqueue(keyFrom, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200))
          console.log('Updated', keyTo)
        })
      } else if (name === 'Endowed') {
        console.log(name, value)
        const key = `${chainId}:${value.account}:native`
        enqueue(key, async () => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          console.log('Updated', key)
        })
      } else {
        console.log(name, value)
        const account = value.who

        if (account) {
          const key = `${chainId}:${account}:native`
          enqueue(key, async () => {
            await new Promise((resolve) => setTimeout(resolve, 250))
            console.log('Updated', key)
          })
        }
      }
    })
}

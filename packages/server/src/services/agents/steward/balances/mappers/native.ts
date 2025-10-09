import { filter, map, mergeMap, switchMap } from 'rxjs'

import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { BalanceUpdateItem, StorageQueryParams } from '../types.js'
import { asBalanceUpdateItem } from './storage.js'

const PALLET_MODULE = 'Balances'
const PALLET_EVENTS = ['Burned', 'Deposit', 'Endowed', 'Minted', 'Transfer', 'Withdraw']
const STORAGE_MODULE = 'System'
const STORAGE_NAME = 'Account'

export function nativeBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    map((apiCtx) => {
      const codec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
      return asBalanceUpdateItem({
        module: STORAGE_MODULE,
        name: STORAGE_NAME,
        chainId,
        asKey: (account: string) => codec.keys.enc(account),
      })
    }),
    switchMap((asStorageItem) =>
      streams.blockEvents(chainId).pipe(
        filter(
          (blockEvent) => blockEvent.module === PALLET_MODULE && PALLET_EVENTS.includes(blockEvent.name),
        ),
        mergeMap(({ name, value }) => {
          const items: BalanceUpdateItem[] = []

          if (name === 'Transfer') {
            const { from, to } = value
            items.push(asStorageItem(from, 'native'), asStorageItem(to, 'native'))
          } else if (name === 'Endowed') {
            items.push(asStorageItem(value.account, 'native'))
          } else {
            items.push(asStorageItem(value.who, 'native'))
          }
          return items
        }),
      ),
    ),
  )
}

export function toNativeStorageKey(account: string, apiCtx: SubstrateApiContext): StorageQueryParams {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  return {
    storageKey: storageCodec.keys.enc(account) as HexString,
    module: STORAGE_MODULE,
    name: STORAGE_NAME,
  }
}

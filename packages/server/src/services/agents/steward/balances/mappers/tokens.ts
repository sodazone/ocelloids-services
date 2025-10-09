import { filter, map, mergeMap, switchMap } from 'rxjs'

import { asJSON } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { AssetId } from '../../types.js'
import { BalancesFromStorage, BalanceUpdateItem } from '../types.js'
import { asBalanceUpdateItem } from './storage.js'

const PALLET_MODULE = 'Tokens'
const PALLET_EVENTS = ['Deposited', 'DustLost', 'Endowed', 'Reserved', 'Transfer', 'Unreserved', 'Withdrawn']
const STORAGE_MODULE = 'Tokens'
const STORAGE_NAME = 'Accounts'

export function tokensBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    map((apiCtx) => {
      const codec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
      return asBalanceUpdateItem({
        module: STORAGE_MODULE,
        name: STORAGE_NAME,
        chainId,
        asKey: codec.keys.enc,
      })
    }),
    switchMap((asStorageItem) =>
      streams.blockEvents(chainId).pipe(
        filter(
          (blockEvent) => blockEvent.module === PALLET_MODULE && PALLET_EVENTS.includes(blockEvent.name),
        ),
        mergeMap(({ name, value }) => {
          const assetId = value.currency_id
          if (!assetId) {
            throw new Error(`No currency id found in ${PALLET_MODULE} event: ${name}`)
          }

          const items: BalanceUpdateItem[] = []

          if (name === 'Transfer') {
            const { from, to } = value
            items.push(asStorageItem(from, assetId), asStorageItem(to, assetId))
          } else {
            const { who } = value
            items.push(asStorageItem(who, assetId))
          }
          return items
        }),
      ),
    ),
  )
}

export function toTokenStorageKey(
  assetId: AssetId,
  account: string,
  apiCtx: SubstrateApiContext,
): BalancesFromStorage | null {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  try {
    const storageKey = storageCodec.keys.enc(account, assetId) as HexString
    return {
      storageKey,
      module: STORAGE_MODULE,
      name: STORAGE_NAME,
    }
  } catch (error) {
    console.error('Error encoding storage key for asset', asJSON(assetId), account, error)
    return null
  }
}

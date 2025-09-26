import { toHex } from 'polkadot-api/utils'
import { filter, map, switchMap } from 'rxjs'

import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalancesFromStorage, EnqueueUpdateItem } from '../types.js'

const PALLET_MODULE = 'Balances'
const PALLET_EVENTS = ['Burned', 'Deposit', 'Endowed', 'Minted', 'Transfer', 'Withdraw']
const STORAGE_MODULE = 'System'
const STORAGE_NAME = 'Account'

export function nativeBalancesSubscription(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress
    .getContext(chainId)
    .pipe(
      switchMap((apiCtx) =>
        streams.blockEvents(chainId).pipe(
          filter(
            (blockEvent) => blockEvent.module === PALLET_MODULE && PALLET_EVENTS.includes(blockEvent.name),
          ),
          map((blockEvent) => {
            return {
              blockEvent,
              apiCtx,
            }
          }),
        ),
      ),
    )
    .subscribe(({ blockEvent: { name, value }, apiCtx }) => {
      const partialData = {
        module: STORAGE_MODULE,
        name: STORAGE_NAME,
        assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, 'native'))) as HexString,
      }
      const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
      const accounts: string[] = []

      if (name === 'Transfer') {
        const { from, to } = value
        accounts.push(from, to)
      } else if (name === 'Endowed') {
        accounts.push(value.account)
      } else {
        const account = value.who
        if (account) {
          accounts.push(account)
        } else {
          console.log('[NATIVE] NOT SUPPORTED EVENT', name)
        }
      }

      for (const account of accounts) {
        enqueue(chainId, storageKeysCodec.enc(account) as HexString, {
          ...partialData,
          type: 'storage',
          account,
          publicKey: asPublicKey(account),
        })
      }
    })
}

export function toNativeStorageKey(account: string, apiCtx: SubstrateApiContext): BalancesFromStorage {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  return {
    storageKey: storageCodec.keys.enc(account) as HexString,
    module: STORAGE_MODULE,
    name: STORAGE_NAME,
  }
}

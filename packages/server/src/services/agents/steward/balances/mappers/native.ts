import { toHex } from 'polkadot-api/utils'
import { filter, mergeMap, switchMap } from 'rxjs'

import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem, BalancesFromStorage } from '../types.js'

const PALLET_MODULE = 'Balances'
const PALLET_EVENTS = ['Burned', 'Deposit', 'Endowed', 'Minted', 'Transfer', 'Withdraw']
const STORAGE_MODULE = 'System'
const STORAGE_NAME = 'Account'

export function nativeBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) =>
      streams.blockEvents(chainId).pipe(
        filter(
          (blockEvent) => blockEvent.module === PALLET_MODULE && PALLET_EVENTS.includes(blockEvent.name),
        ),
        mergeMap(({ name, value }) => {
          const partialData = {
            module: STORAGE_MODULE,
            name: STORAGE_NAME,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, 'native'))) as HexString,
          }
          const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
          const items: BalanceUpdateItem[] = []

          if (name === 'Transfer') {
            const { from, to } = value
            items.push(
              {
                storageKey: storageKeysCodec.enc(from) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: from,
                  publicKey: asPublicKey(from),
                },
              },
              {
                storageKey: storageKeysCodec.enc(to) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: to,
                  publicKey: asPublicKey(to),
                },
              },
            )
          } else if (name === 'Endowed') {
            const { account } = value
            items.push({
              storageKey: storageKeysCodec.enc(account) as HexString,
              data: {
                ...partialData,
                type: 'storage',
                account: account,
                publicKey: asPublicKey(account),
              },
            })
          } else {
            const account = value.who
            items.push({
              storageKey: storageKeysCodec.enc(account) as HexString,
              data: {
                ...partialData,
                type: 'storage',
                account: account,
                publicKey: asPublicKey(account),
              },
            })
          }
          return items
        }),
      ),
    ),
  )
}

export function toNativeStorageKey(account: string, apiCtx: SubstrateApiContext): BalancesFromStorage {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  return {
    storageKey: storageCodec.keys.enc(account) as HexString,
    module: STORAGE_MODULE,
    name: STORAGE_NAME,
  }
}

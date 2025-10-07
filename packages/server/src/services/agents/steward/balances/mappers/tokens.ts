import { toHex } from 'polkadot-api/utils'
import { filter, mergeMap, switchMap } from 'rxjs'

import { asJSON, asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem, BalancesFromStorage } from '../types.js'

const PALLET_MODULE = 'Tokens'
const PALLET_EVENTS = ['Deposited', 'DustLost', 'Endowed', 'Reserved', 'Transfer', 'Unreserved', 'Withdrawn']
const STORAGE_MODULE = 'Tokens'
const STORAGE_NAME = 'Accounts'

export function tokensBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) =>
      streams.blockEvents(chainId).pipe(
        filter(
          (blockEvent) => blockEvent.module === PALLET_MODULE && PALLET_EVENTS.includes(blockEvent.name),
        ),
        mergeMap(({ name, value }) => {
          const assetId = value.currency_id
          if (!assetId) {
            throw new Error(`No currency id found in ${PALLET_MODULE} event: ${name}`)
          }
          const partialData = {
            module: STORAGE_MODULE,
            name: STORAGE_NAME,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
          }
          const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
          const items: BalanceUpdateItem[] = []

          if (name === 'Transfer') {
            const { from, to } = value
            items.push(
              {
                storageKey: storageKeysCodec.enc(from, assetId) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: from,
                  publicKey: asPublicKey(from),
                },
              },
              {
                storageKey: storageKeysCodec.enc(to, assetId) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: to,
                  publicKey: asPublicKey(to),
                },
              },
            )
          } else {
            const { who } = value
            items.push({
              storageKey: storageKeysCodec.enc(who, assetId) as HexString,
              data: {
                ...partialData,
                type: 'storage',
                account: who,
                publicKey: asPublicKey(who),
              },
            })
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
    console.log('Error encoding storage key for asset', asJSON(assetId), account, error)
    return null
  }
}

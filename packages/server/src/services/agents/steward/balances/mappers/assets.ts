import { EMPTY, filter, map, mergeMap, switchMap } from 'rxjs'

import { asJSON } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { serializeStorageKeyArg } from '@/services/networking/substrate/common/storage.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { AssetId } from '../../types.js'
import { BalanceUpdateItem, StorageQueryParams } from '../types.js'
import { asBalanceUpdateItem } from './storage.js'

const PALLET_EVENTS = ['Burned', 'Deposited', 'Issued', 'Transferred', 'Withdrawn']
const STORAGE_NAME = 'Account'

export function foreignAssetsBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  return genericAssetsBalances$(chainId, ingress, 'ForeignAssets')
}

export function assetsBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  return genericAssetsBalances$(chainId, ingress, 'Assets')
}

function genericAssetsBalances$(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  module: 'Assets' | 'ForeignAssets',
) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    map((apiCtx) => {
      const codec = apiCtx.storageCodec(module, STORAGE_NAME)
      return asBalanceUpdateItem({
        module,
        name: STORAGE_NAME,
        chainId,
        asKey: (account: string, assetId: AssetId) =>
          codec.keys.enc(serializeStorageKeyArg(assetId), account),
      })
    }),
    switchMap((asStorageItem) =>
      streams.blockEvents(chainId).pipe(
        filter((blockEvent) => blockEvent.module === module && PALLET_EVENTS.includes(blockEvent.name)),
        mergeMap(({ name, value }) => {
          const assetId = value.asset_id
          if (!assetId) {
            console.error(`No asset id found in ${module} event: ${name}`)
            return EMPTY
          }
          const items: BalanceUpdateItem[] = []

          if (name === 'Transferred') {
            const { from, to } = value
            items.push(asStorageItem(from, assetId), asStorageItem(to, assetId))
          } else if (name === 'Issued' || name === 'Burned') {
            items.push(asStorageItem(value.owner, assetId))
          } else {
            items.push(asStorageItem(value.who, assetId))
          }
          return items
        }),
      ),
    ),
  )
}

export function toAssetsStorageKey(assetId: AssetId | bigint, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(assetId, account, apiCtx, 'Assets')
}

export function toForeignAssetsStorageKey(assetId: AssetId, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(serializeStorageKeyArg(assetId), account, apiCtx, 'ForeignAssets')
}

export function toGenericAssetStorageKey(
  assetId: AssetId | bigint,
  account: string,
  apiCtx: SubstrateApiContext,
  module: 'Assets' | 'ForeignAssets',
): StorageQueryParams | null {
  const storageCodec = apiCtx.storageCodec(module, STORAGE_NAME)
  try {
    const storageKey = storageCodec.keys.enc(assetId, account) as HexString
    return {
      storageKey,
      module,
      name: STORAGE_NAME,
    }
  } catch (error) {
    console.error('Error encoding storage key for asset', asJSON(assetId), account, error)
    return null
  }
}

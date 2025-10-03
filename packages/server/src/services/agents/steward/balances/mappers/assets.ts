import { Binary } from 'polkadot-api'
import { fromHex, toHex } from 'polkadot-api/utils'
import { filter, mergeMap, switchMap } from 'rxjs'

import { asJSON, asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem, BalancesFromStorage } from '../types.js'

const PALLET_EVENTS = ['Burned', 'Deposited', 'Issued', 'Transferred', 'Withdrawn']
const STORAGE_NAME = 'Account'

export function serializeFields(obj: any): any {
  if (obj == null) {
    return obj
  }

  if (typeof obj === 'string' && obj.startsWith('0x')) {
    return new Binary(fromHex(obj))
  }

  if (typeof obj === 'string') {
    try {
      return BigInt(obj)
    } catch (_error) {
      //
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeFields)
  }

  if (typeof obj === 'object') {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = serializeFields(value)
    }
    return newObj
  }

  return obj
}

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
    switchMap((apiCtx) =>
      streams.blockEvents(chainId).pipe(
        filter((blockEvent) => blockEvent.module === module && PALLET_EVENTS.includes(blockEvent.name)),
        mergeMap(({ name, value }) => {
          const assetId = value.asset_id
          if (!assetId) {
            throw new Error(`No asset id found in ${module} event: ${name}`)
          }

          const partialData = {
            module,
            name: STORAGE_NAME,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
          }
          const storageKeysCodec = apiCtx.storageCodec(module, STORAGE_NAME).keys
          const items: BalanceUpdateItem[] = []

          if (name === 'Transferred') {
            const { from, to } = value
            items.push(
              {
                storageKey: storageKeysCodec.enc(serializeFields(assetId), from) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: from,
                  publicKey: asPublicKey(from),
                },
              },
              {
                storageKey: storageKeysCodec.enc(serializeFields(assetId), to) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: to,
                  publicKey: asPublicKey(to),
                },
              },
            )
          } else if (name === 'Issued' || name === 'Burned') {
            const { owner } = value
            items.push({
              storageKey: storageKeysCodec.enc(serializeFields(assetId), owner) as HexString,
              data: {
                ...partialData,
                type: 'storage',
                account: owner,
                publicKey: asPublicKey(owner),
              },
            })
          } else {
            const { who } = value
            items.push({
              storageKey: storageKeysCodec.enc(serializeFields(assetId), who) as HexString,
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

export function toAssetsStorageKey(assetId: AssetId | bigint, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(assetId, account, apiCtx, 'Assets')
}

export function toForeignAssetsStorageKey(assetId: AssetId, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(serializeFields(assetId), account, apiCtx, 'ForeignAssets')
}

export function toGenericAssetStorageKey(
  assetId: AssetId | bigint,
  account: string,
  apiCtx: SubstrateApiContext,
  module: 'Assets' | 'ForeignAssets',
): BalancesFromStorage | null {
  const storageCodec = apiCtx.storageCodec(module, STORAGE_NAME)
  try {
    const storageKey = storageCodec.keys.enc(assetId, account) as HexString
    return {
      storageKey,
      module,
      name: STORAGE_NAME,
    }
  } catch (error) {
    console.log('Error encoding storage key for asset', asJSON(assetId), account, error)
    return null
  }
}

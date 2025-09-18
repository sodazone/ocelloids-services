import { Binary } from 'polkadot-api'
import { fromHex, toHex } from 'polkadot-api/utils'
import { filter, map, switchMap } from 'rxjs'

import { asJSON, asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { EnqueueUpdateItem } from '../types.js'

const PALLET_EVENTS = ['Burned', 'Deposited', 'Issued', 'Transferred', 'Withdrawn']
const STORAGE_NAME = 'Account'

function transformHexFields(obj: any): any {
  if (obj == null) {
    return obj
  }

  if (typeof obj === 'string' && obj.startsWith('0x')) {
    return new Binary(fromHex(obj))
  }

  if (Array.isArray(obj)) {
    return obj.map(transformHexFields)
  }

  if (typeof obj === 'object') {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = transformHexFields(value)
    }
    return newObj
  }

  return obj
}

export function foreignAssetsBalancesSubscription(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
) {
  return genericAssetsBalancesSubscription(chainId, ingress, enqueue, 'ForeignAssets')
}

export function assetsBalancesSubscription(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
) {
  return genericAssetsBalancesSubscription(chainId, ingress, enqueue, 'Assets')
}

function genericAssetsBalancesSubscription(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
  module: 'Assets' | 'ForeignAssets',
) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress
    .getContext(chainId)
    .pipe(
      switchMap((apiCtx) =>
        streams.blockEvents(chainId).pipe(
          filter((blockEvent) => blockEvent.module === module && PALLET_EVENTS.includes(blockEvent.name)),
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
      const assetId = value.asset_id
      if (!assetId) {
        console.log('No asset_id found in event', name)
        return
      }
      const partialData = {
        module,
        name: STORAGE_NAME,
        assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, value.asset_id))) as HexString,
      }
      const storageKeysCodec = apiCtx.storageCodec(module, STORAGE_NAME).keys
      const accounts: string[] = []

      if (name === 'Transferred') {
        const { from, to } = value
        accounts.push(from, to)
      } else if (name === 'Issued' || name === 'Burned') {
        const { owner } = value
        accounts.push(owner)
      } else {
        const account = value.who
        if (account) {
          accounts.push(account)
        } else {
          console.log('[ASSETS] NOT SUPPORTED EVENT', name)
        }
      }

      for (const account of accounts) {
        try {
          enqueue(chainId, storageKeysCodec.enc(assetId, account) as HexString, {
            ...partialData,
            account,
            publicKey: asPublicKey(account),
          })
        } catch (error) {
          console.log('ERROR encoding storage key', asJSON(assetId), account, error)
        }
      }
    })
}

export function toAssetsStorageKey(assetId: AssetId, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(assetId, account, apiCtx, 'Assets')
}

export function toForeignAssetsStorageKey(assetId: AssetId, account: string, apiCtx: SubstrateApiContext) {
  return toGenericAssetStorageKey(transformHexFields(assetId), account, apiCtx, 'ForeignAssets')
}

export function toGenericAssetStorageKey(
  assetId: AssetId,
  account: string,
  apiCtx: SubstrateApiContext,
  module: 'Assets' | 'ForeignAssets',
) {
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

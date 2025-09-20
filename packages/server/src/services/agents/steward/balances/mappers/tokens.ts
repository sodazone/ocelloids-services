import { asJSON, asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { toHex } from 'polkadot-api/utils'
import { filter, map, switchMap } from 'rxjs'
import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { EnqueueUpdateItem } from '../types.js'

const PALLET_MODULE = 'Tokens'
const PALLET_EVENTS = ['Deposited', 'DustLost', 'Endowed', 'Reserved', 'Transfer', 'Unreserved', 'Withdrawn']
const STORAGE_MODULE = 'Tokens'
const STORAGE_NAME = 'Accounts'

export function tokensBalancesSubscription(
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
      const assetId = value.currency_id
      if (!assetId) {
        console.log('No currency_id found in event', name)
        return
      }
      const partialData = {
        module: STORAGE_MODULE,
        name: STORAGE_NAME,
        assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
      }
      const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
      const accounts: string[] = []

      if (name === 'Transfer') {
        const { from, to } = value
        accounts.push(from, to)
      } else {
        const account = value.who
        if (account) {
          accounts.push(account)
        } else {
          console.log('[TOKENS] NOT SUPPORTED EVENT', name)
        }
      }

      for (const account of accounts) {
        enqueue(chainId, storageKeysCodec.enc(account, assetId) as HexString, {
          ...partialData,
          account,
          publicKey: asPublicKey(account),
        })
      }
    })
}

export function toTokenStorageKey(assetId: AssetId, account: string, apiCtx: SubstrateApiContext) {
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

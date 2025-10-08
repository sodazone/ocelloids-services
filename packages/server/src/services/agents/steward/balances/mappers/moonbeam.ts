import { toHex } from 'polkadot-api/utils'
import { filter, map, mergeMap, switchMap } from 'rxjs'

import { asPublicKey } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { isEVMLog } from '@/services/networking/substrate/evm/decoder.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem, BalancesFromStorage } from '../types.js'
import { getFrontierAccountStoragesSlot, toBinary } from '../util.js'
import { decodeLog } from './evm.js'

const STORAGE_MODULE = 'EVM'
const STORAGE_NAME = 'AccountStorages'

function contractToAssetId(address: string): string {
  const addrStr = address.toLowerCase().slice(2)

  if (addrStr.startsWith('ffffffff')) {
    const hexPart = addrStr.slice(8)
    return BigInt('0x' + hexPart).toString()
  }

  return address
}

export function moonbeamBalances$(chainId: NetworkURN, ingress: SubstrateIngressConsumer) {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    map((apiCtx) => {
      const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
      return (account: HexString, contractAddress: HexString, assetId: AssetId): BalanceUpdateItem => {
        const publicKey = asPublicKey(account)
        const partialData = {
          module: STORAGE_MODULE,
          name: STORAGE_NAME,
          assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
        }

        return {
          queueKey: `${publicKey}::${partialData.assetKeyHash}`,
          data: {
            ...partialData,
            type: 'storage',
            account,
            publicKey,
            storageKey: storageCodec.keys.enc(
              toBinary(contractAddress),
              toBinary(getFrontierAccountStoragesSlot(account, 0)),
            ) as HexString,
          },
        }
      }
    }),
    switchMap((asStorageItem) =>
      streams.blockEvents(chainId).pipe(
        filter((ev) => isEVMLog(ev)),
        map(decodeLog),
        filter(Boolean),
        mergeMap(({ address, decoded }) => {
          const assetId = contractToAssetId(address)
          const items: BalanceUpdateItem[] = []

          if (decoded) {
            const { from, to } = decoded.args as { from: HexString; to: HexString }
            items.push(
              asStorageItem(from, address as HexString, assetId),
              asStorageItem(to, address as HexString, assetId),
            )
          }
          return items
        }),
      ),
    ),
  )
}

export function toEVMStorageKey(
  contractAddress: HexString,
  slotKey: HexString,
  apiCtx: SubstrateApiContext,
): BalancesFromStorage | null {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  try {
    const storageKey = storageCodec.keys.enc(toBinary(contractAddress), toBinary(slotKey)) as HexString
    return {
      storageKey,
      module: STORAGE_MODULE,
      name: STORAGE_NAME,
    }
  } catch (error) {
    console.error(
      error,
      'Error encoding storage key for EVM contract address=%s slot=%s',
      contractAddress,
      slotKey,
    )
    return null
  }
}

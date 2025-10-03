import { HexString, NetworkURN } from '@/lib.js'
import { isEVMLog } from '@/services/networking/substrate/evm/decoder.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Binary } from 'polkadot-api'
import { fromHex, toHex } from 'polkadot-api/utils'
import { filter, map, mergeMap, switchMap } from 'rxjs'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem, BalancesFromStorage } from '../types.js'
import { toBinary } from '../util.js'
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
    switchMap((apiCtx) =>
      streams.blockEvents(chainId).pipe(
        filter((ev) => isEVMLog(ev)),
        map(decodeLog),
        filter(Boolean),
        mergeMap(({ address, decoded }) => {
          const assetId = contractToAssetId(address)

          const partialData = {
            module: STORAGE_MODULE,
            name: STORAGE_NAME,
            assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
          }
          const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
          const items: BalanceUpdateItem[] = []

          if (decoded) {
            const { from, to } = decoded.args
            items.push(
              {
                storageKey: storageKeysCodec.enc(
                  new Binary(fromHex(assetId)),
                  new Binary(fromHex(from)),
                ) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: from,
                  publicKey: from as HexString,
                },
              },
              {
                storageKey: storageKeysCodec.enc(
                  new Binary(fromHex(assetId)),
                  new Binary(fromHex(to)),
                ) as HexString,
                data: {
                  ...partialData,
                  type: 'storage',
                  account: to,
                  publicKey: to as HexString,
                },
              },
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

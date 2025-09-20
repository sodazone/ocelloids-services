import { asJSON } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { extractEvmLogs } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { toHex } from 'polkadot-api/utils'
import { filter, map, switchMap } from 'rxjs'
import { erc20Abi } from 'viem'
import { assetOverrides } from '../../metadata/overrides.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { EnqueueUpdateItem } from '../types.js'
import { toBinary } from '../util.js'

const EVM_EVENTS = ['Transfer']
const STORAGE_MODULE = 'EVM'
const STORAGE_NAME = 'AccountStorages'

const evmConfig = [
  {
    abi: erc20Abi,
    addresses: assetOverrides
      .map(({ chainId, id }) => (chainId === 'urn:ocn:polkadot:2004' && typeof id === 'string' ? id : null))
      .filter((a) => a !== null),
  },
]

function contractToAssetId(address: string): string {
  const addrStr = address.toLowerCase().slice(2)

  if (addrStr.startsWith('ffffffff')) {
    const hexPart = addrStr.slice(8)
    return BigInt('0x' + hexPart).toString()
  }

  return address
}

export function moonbeamBalancesSubscription(
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
          extractEvmLogs(evmConfig),
          filter(({ decoded }) => decoded?.eventName !== undefined && EVM_EVENTS.includes(decoded.eventName)),
          map((blockEvent) => {
            return {
              blockEvent,
              apiCtx,
            }
          }),
        ),
      ),
    )
    .subscribe(({ blockEvent: { address, decoded }, apiCtx }) => {
      const assetId = contractToAssetId(address)

      const partialData = {
        module: STORAGE_MODULE,
        name: STORAGE_NAME,
        assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
      }
      const storageKeysCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME).keys
      const accounts: string[] = []

      if (decoded) {
        const { from, to } = decoded.args
        accounts.push(from, to)
      }

      for (const account of accounts) {
        try {
          enqueue(chainId, storageKeysCodec.enc(assetId, account) as HexString, {
            ...partialData,
            account,
            publicKey: account as HexString,
          })
        } catch (error) {
          console.error(error, 'ERROR encoding storage key asset=%s account=%s', asJSON(assetId), account)
        }
      }
    })
}

export function toEVMStorageKey(contractAddress: HexString, slotKey: HexString, apiCtx: SubstrateApiContext) {
  const storageCodec = apiCtx.storageCodec(STORAGE_MODULE, STORAGE_NAME)
  try {
    const storageKey = storageCodec.keys.enc(toBinary(contractAddress), toBinary(slotKey)) as HexString
    return {
      storageKey,
      module: STORAGE_MODULE,
      name: STORAGE_NAME,
    }
  } catch (error) {
    console.error(error, 'Error encoding storage key for EVM contract address=%s slot=%s', contractAddress, slotKey)
    return null
  }
}

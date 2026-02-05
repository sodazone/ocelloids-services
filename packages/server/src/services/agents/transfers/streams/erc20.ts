import { filter, map, Observable } from 'rxjs'
import { isZeroAddress } from '@/common/address.js'
import { asPublicKey } from '@/common/util.js'
import { isEVMLog } from '@/services/networking/substrate/evm/decoder.js'
import { decodeTransferLog } from '@/services/networking/substrate/evm/logs.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { toMelbourne } from '../../common/melbourne.js'
import { Transfer } from '../types.js'

// duplicated with steward balances hydration mapping
const hydrationContractToAssetId: Record<string, number> = {
  '0x02639ec01313c8775fae74f2dad1118c8a8a86da': 1001,
  '0xc64980e4eaf9a1151bd21712b9946b81e41e2b92': 1002,
  '0x2ec4884088d84e5c2970a034732e5209b0acfa93': 1003,
  '0x02759d14d0d4f452b9c76f5a230750e8857d36f2': 1004,
  '0x0e13b904f4168f93814216b6874ca8349457f263': 1005,
  '0x69003a65189f6ed993d3bd3e2b74f1db39f405ce': 1006,
  '0x11a8f7ffbb7e0fbed88bc20179dd45b4bd6874ff': 1007,
  '0xc09cf2f85367f3c2ab66e094283de3a499cb9108': 1008,
  '0x00f283c7a97ecb60dd905cdab52febceec04dc0f': 1039,
  '0x35774c305aaf441a102d47988d35f0f5428471b3': 1110,
  '0x1806860d27ee903c1ec7586d4f7d598d7591f124': 1111,
  '0x7e3ce0257506c3e1f96a2a9b25a9440959b0d453': 1112,
  '0x52e1311e26610e6662a1e5b5bd113130b6815213': 1113,
  '0x531a654d1696ed52e7275a8cede955e82620f99a': 222,
  '0x8a598fe3e3a471ce865332e330d303502a0e2f52': 420,
  '0x34d5ffb83d14d82f87aaf2f13be895a3c814c2ad': 69,
}

// duplicated with steward balances moonbeam mapping
function moonbeamContractToAssetId(address: string): string {
  const addrStr = address.toLowerCase().slice(2)

  if (addrStr.startsWith('ffffffff')) {
    const hexPart = addrStr.slice(8)
    return BigInt('0x' + hexPart).toString()
  }

  return address
}

type AssetResolver = (contract: string) => string | undefined

export function erc20Transfers$(
  blockEvents$: Observable<BlockEvent>,
  resolveAsset: AssetResolver,
): Observable<Transfer> {
  return blockEvents$.pipe(
    filter((ev) => isEVMLog(ev)),
    map(decodeTransferLog),
    filter(Boolean),
    map(({ address, decoded, blockHash, blockNumber, blockPosition, extrinsic, timestamp, module, name }) => {
      if (!decoded) {
        return null
      }
      // skip AAVE aToken principal transfer events
      if (decoded.eventName.toLowerCase() === 'balancetransfer') {
        return null
      }

      const { from, to, value } = decoded.args
      if (isZeroAddress(from) || isZeroAddress(to)) {
        return null
      }

      const asset = resolveAsset(address)
      if (!asset) {
        return null
      }

      return {
        asset,
        from: asPublicKey(from),
        to: asPublicKey(to),
        fromFormatted: from,
        toFormatted: to,
        amount: value.toString(),
        blockNumber: blockNumber.toString(),
        blockHash,
        timestamp,
        event: {
          module,
          name,
          blockPosition,
          value,
        },
        extrinsic,
      } satisfies Transfer
    }),
    filter((t) => t !== null),
  )
}

export function hydrationErc20Transfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return erc20Transfers$(blockEvents$, (contract) => {
    const assetId = hydrationContractToAssetId[contract.toLowerCase()]
    return assetId ? toMelbourne(assetId) : undefined
  })
}

export function moonbeamErc20Transfers$(blockEvents$: Observable<BlockEvent>): Observable<Transfer> {
  return erc20Transfers$(blockEvents$, moonbeamContractToAssetId)
}

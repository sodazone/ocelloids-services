import { asPublicKey } from '@/common/index.js'
import { HexString, NetworkURN } from '@/lib.js'
import { toHex } from 'polkadot-api/utils'
import { AssetId } from '../../types.js'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { BalanceUpdateItem } from '../types.js'

export function asBalanceUpdateItem({
  module,
  name,
  asKey,
  chainId,
}: {
  module: string
  name: string
  asKey: (account: string, assetId: AssetId) => string
  chainId: NetworkURN
}) {
  return (account: string, assetId: AssetId): BalanceUpdateItem => {
    const publicKey = asPublicKey(account)
    const partialData = {
      module,
      name,
      assetKeyHash: toHex(assetMetadataKeyHash(assetMetadataKey(chainId, assetId))) as HexString,
    }
    return {
      queueKey: `${publicKey}::${partialData.assetKeyHash}`,
      data: {
        ...partialData,
        type: 'storage',
        account,
        publicKey,
        storageKey: asKey(account, assetId) as HexString,
      },
    }
  }
}

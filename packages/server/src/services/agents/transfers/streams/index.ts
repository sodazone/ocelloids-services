import { map, merge, Observable } from 'rxjs'
import { networks } from '@/services/agents/common/networks.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { Transfer } from '../types.js'
import { assetTransfers$, currenciesTransfers$, tokensTransfers$ } from './assets.js'
import { hydrationErc20Transfers$, moonbeamErc20Transfers$ } from './erc20.js'
import { nativeTransfers$ } from './native.js'

const interlayNativeTokenMap: Record<string, string> = {
  INTR: 'native',
  IBTC: 'native:IBTC',
  DOT: 'native:DOT',
  KSM: 'native:KSM',
  KINT: 'native:KINT',
  KBTC: 'native:KBTC',
}

type TransferStreamMapper = (blockEvents$: Observable<BlockEvent>) => Observable<Transfer>

export const transferStreamMappers: Record<string, TransferStreamMapper> = {
  [networks.polkadot]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.assetHub]: (blockEvents$) => {
    return merge(nativeTransfers$(blockEvents$), assetTransfers$(blockEvents$))
  },
  [networks.bridgeHub]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.coretime]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.people]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.acala]: (blockEvents$) => {
    return currenciesTransfers$(blockEvents$)
  },
  [networks.moonbeam]: (blockEvents$) => {
    return merge(nativeTransfers$(blockEvents$), moonbeamErc20Transfers$(blockEvents$))
  },
  [networks.astar]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.bifrost]: (blockEvents$) => {
    return merge(nativeTransfers$(blockEvents$), tokensTransfers$(blockEvents$))
  },
  [networks.interlay]: (blockEvents$) => {
    return merge(
      nativeTransfers$(blockEvents$),
      tokensTransfers$(blockEvents$).pipe(
        map((tf) => {
          const asset = tf.asset

          if (typeof asset === 'object' && 'type' in asset && 'value' in asset) {
            if (asset.type === 'Token' && asset.value?.type) {
              const mapped = interlayNativeTokenMap[asset.value.type]
              if (mapped) {
                return { ...tf, asset: mapped }
              }
            } else if (asset.type === 'ForeignAsset' && asset.value) {
              return { ...tf, asset: asset.value }
            }
          }
          console.warn('Unknown interlay asset type', asset)
          return tf
        }),
      ),
    )
  },
  [networks.hydration]: (blockEvents$) => {
    return merge(
      nativeTransfers$(blockEvents$),
      currenciesTransfers$(blockEvents$),
      tokensTransfers$(blockEvents$),
      hydrationErc20Transfers$(blockEvents$),
    )
  },
  [networks.hyperbridge]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.kusama]: (blockEvents$) => {
    return nativeTransfers$(blockEvents$)
  },
  [networks.kusamaAssetHub]: (blockEvents$) => {
    return merge(nativeTransfers$(blockEvents$), assetTransfers$(blockEvents$))
  },
}

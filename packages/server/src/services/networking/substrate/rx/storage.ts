import { EMPTY, expand } from 'rxjs'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { SubstrateIngressConsumer } from '../ingress/types.js'

const STORAGE_PAGE_LEN = 50

export function storageKeysAtLatest$(
  ingress: SubstrateIngressConsumer,
  chainId: NetworkURN,
  prefix: HexString,
) {
  return ingress
    .getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN)
    .pipe(
      expand((keys) =>
        keys.length === STORAGE_PAGE_LEN
          ? ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
          : EMPTY,
      ),
    )
}

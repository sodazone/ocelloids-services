import { concatMap, EMPTY, expand, from, mergeMap, Observable, of, switchMap, take } from 'rxjs'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { itemKeyFromStorageKey } from '../common/storage.js'
import { SubstrateIngressConsumer } from '../ingress/types.js'

const STORAGE_PAGE_LEN = 50

type DecodedStorageEntry<TKey = unknown, TValue = unknown> = {
  key: TKey
  value: TValue
}

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

export function storageEntriesAtLatest$<TK = unknown, TV = unknown>(
  ingress: SubstrateIngressConsumer,
  chainId: NetworkURN,
  pallet: string,
  method: string,
): Observable<DecodedStorageEntry<TK, TV>> {
  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) => {
      if (!apiCtx.hasPallet(pallet)) {
        return EMPTY
      }

      const codec = apiCtx.storageCodec(pallet, method)
      const hashers = apiCtx.getHashers(pallet, method)
      const prefix = codec.keys.enc() as HexString

      return storageKeysAtLatest$(ingress, chainId, prefix).pipe(
        concatMap((storageKeys) =>
          ingress.queryStorageAt(chainId, storageKeys).pipe(
            mergeMap((changeSets) => {
              const changes = changeSets[0]?.changes ?? []

              return from(storageKeys).pipe(
                mergeMap((storageKey) => {
                  const change = changes.find(([k]) => k === storageKey)

                  if (!change || !change[1]) {
                    return EMPTY
                  }

                  return of({
                    key: itemKeyFromStorageKey(storageKey, prefix, hashers) as TK,
                    value: codec.value.dec(change[1]) as TV,
                  })
                }),
              )
            }),
          ),
        ),
      )
    }),
  )
}

import { blake2b } from '@noble/hashes/blake2'
import { FixedSizeBinary, u32 } from '@polkadot-api/substrate-bindings'
import { fromHex, toHex } from 'polkadot-api/utils'

import {
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  reduce,
  switchMap,
  take,
} from 'rxjs'
import { storageKeysAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Hashers } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../../common/networks.js'
import { assetOverrides } from '../metadata/overrides.js'
import { accountOverrides } from './overrides.js'
import { SubstrateAccountMetadata, SubstrateAccountUpdate } from './types.js'

const textEncoder = new TextEncoder()
const sts = textEncoder.encode('sts')

function decodeData(data: any): string | undefined {
  if (!data) {
    return undefined
  }

  switch (data.type) {
    case 'None':
    case 'Empty':
      return undefined

    default:
      if (typeof data.value?.asText === 'function') {
        return data.value.asText()
      }

      return data.value?.toString?.()
  }
}

function normalizeIdentity(identity: any): {
  display: string
  judgements: string[]
  extra: Record<string, any>
} {
  const info = identity.info ?? {}

  const extra: Record<string, any> = {}

  for (const [key, value] of Object.entries(info)) {
    const decoded = decodeData(value)
    if (decoded !== undefined) {
      extra[key] = decoded
    }
  }

  const display = extra.display ?? ''

  const judgements = identity.judgements?.map(([, judgement]: any) => judgement.type) ?? []

  return {
    display,
    judgements,
    extra,
  }
}

function itemKeyFromStorageKey(
  fullStorageKey: HexString,
  prefix: HexString,
  hashers: Hashers | null,
): HexString {
  const fullHex = fullStorageKey.startsWith('0x') ? fullStorageKey.slice(2) : fullStorageKey

  const prefixHex = prefix.startsWith('0x') ? prefix.slice(2) : prefix

  if (!fullHex.startsWith(prefixHex)) {
    throw new Error('Storage key does not start with given prefix')
  }

  let remaining = fullHex.slice(prefixHex.length)

  if (hashers === null) {
    return `0x${remaining}` as HexString
  }

  for (const hasher of hashers) {
    switch (hasher.tag) {
      case 'Identity':
        return `0x${remaining}` as HexString

      case 'Twox64Concat': {
        const HASH_BYTES = 8
        remaining = remaining.slice(HASH_BYTES * 2)
        return `0x${remaining}` as HexString
      }

      case 'Blake2128Concat': {
        const HASH_BYTES = 16
        remaining = remaining.slice(HASH_BYTES * 2)
        return `0x${remaining}` as HexString
      }

      case 'Twox128':
        remaining = remaining.slice(16 * 2)
        break

      case 'Blake2128':
        remaining = remaining.slice(16 * 2)
        break

      case 'Twox256':
      case 'Blake2256':
        remaining = remaining.slice(32 * 2)
        break

      default:
        throw new Error(`Unsupported hasher: ${(hasher as any).tag}`)
    }
  }

  throw new Error('No raw key present in storage key for given hashers')
}

function deepEqualIdentity(
  a: SubstrateAccountMetadata['identities'][number],
  b: SubstrateAccountMetadata['identities'][number],
): boolean {
  return (
    a.display === b.display &&
    JSON.stringify(a.judgements) === JSON.stringify(b.judgements) &&
    JSON.stringify(a.extra) === JSON.stringify(b.extra)
  )
}

export const overrideAccounts$: Observable<SubstrateAccountUpdate> = from(accountOverrides)

export function mergeAccountMetadata(
  persisted: SubstrateAccountMetadata | undefined,
  incoming: SubstrateAccountUpdate,
): SubstrateAccountMetadata {
  const now = Date.now()

  if (!persisted) {
    return {
      publicKey: incoming.publicKey,
      evm: incoming.evm ?? [],
      identities: incoming.identities ?? [],
      categories: incoming.categories ?? [],
      tags: incoming.tags ?? [],
      updatedAt: now,
    }
  }

  let changed = false

  const evmMap = new Map<string, SubstrateAccountMetadata['evm'][number]>()
  for (const e of persisted.evm ?? []) {
    evmMap.set(`${e.chainId}|${e.address}`, e)
  }
  for (const e of incoming.evm ?? []) {
    const key = `${e.chainId}|${e.address}`
    if (!evmMap.has(key)) {
      evmMap.set(key, e)
      changed = true
    }
  }
  const evm = Array.from(evmMap.values())

  const identityMap = new Map<NetworkURN, SubstrateAccountMetadata['identities'][number]>()
  for (const i of persisted.identities ?? []) {
    identityMap.set(i.chainId, i)
  }
  for (const i of incoming.identities ?? []) {
    const existing = identityMap.get(i.chainId)
    if (!existing || !deepEqualIdentity(existing, i)) {
      identityMap.set(i.chainId, i)
      changed = true
    }
  }
  const identities = Array.from(identityMap.values())

  const categoryMap = new Map<string, SubstrateAccountMetadata['categories'][number]>()
  for (const c of persisted.categories ?? []) {
    categoryMap.set(`${c.chainId}|${c.categoryCode}|${c.subCategoryCode}`, c)
  }
  for (const c of incoming.categories ?? []) {
    const key = `${c.chainId}|${c.categoryCode}|${c.subCategoryCode}`
    if (!categoryMap.has(key)) {
      categoryMap.set(key, c)
      changed = true
    }
  }
  const categories = Array.from(categoryMap.values())

  const tagMap = new Map<string, SubstrateAccountMetadata['tags'][number]>()
  for (const t of persisted.tags ?? []) {
    tagMap.set(`${t.chainId}|${t.tag}`, t)
  }
  for (const t of incoming.tags ?? []) {
    const key = `${t.chainId}|${t.tag}`
    if (!tagMap.has(key)) {
      tagMap.set(key, t)
      changed = true
    }
  }
  const tags = Array.from(tagMap.values())

  if (!changed) {
    return persisted
  }

  return {
    publicKey: incoming.publicKey,
    evm,
    identities,
    categories,
    tags,
    updatedAt: now,
  }
}

export function identities$(ingress: SubstrateIngressConsumer, chainId: NetworkURN) {
  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) => {
      if (!apiCtx.hasPallet('Identity')) {
        return EMPTY
      }
      const codec = apiCtx.storageCodec('Identity', 'IdentityOf')
      const hashers = apiCtx.getHashers('Identity', 'IdentityOf')
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

                  const publicKey = itemKeyFromStorageKey(storageKey, prefix, hashers)

                  const identity = codec.value.dec(change[1])

                  return of({
                    publicKey,
                    identities: Array.isArray(identity)
                      ? identity
                          .map((i) => (i !== undefined ? { ...normalizeIdentity(i), chainId } : undefined))
                          .filter((ni) => ni !== undefined)
                      : [{ ...normalizeIdentity(identity), chainId }],
                    updatedAt: Date.now(),
                  } satisfies SubstrateAccountUpdate)
                }),
              )
            }),
          ),
        ),
      )
    }),
  )
}

function hydrationEvmAccounts$(ingress: SubstrateIngressConsumer): Observable<SubstrateAccountUpdate> {
  const chainId = networks.hydration
  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('EVMAccounts', 'AccountExtension')
      const hashers = apiCtx.getHashers('EVMAccounts', 'AccountExtension')
      const prefix = codec.keys.enc() as HexString
      return storageKeysAtLatest$(ingress, chainId, prefix).pipe(
        concatMap((storageKeys) =>
          ingress.queryStorageAt(chainId, storageKeys).pipe(
            mergeMap((changeSets) => {
              const changes = changeSets[0]?.changes ?? []

              return from(storageKeys).pipe(
                mergeMap((storageKey) => {
                  const change = changes.find(([k]) => k === storageKey)
                  if (!change) {
                    return EMPTY
                  }

                  const evmAddress = itemKeyFromStorageKey(storageKey, prefix, hashers)

                  const rawValue = change[1]
                  const extension = rawValue ? codec.value.dec(rawValue as HexString) : null

                  let buf: Buffer
                  if (extension) {
                    buf = Buffer.concat([fromHex(evmAddress), extension.asBytes()])
                  } else {
                    buf = Buffer.from(fromHex(evmAddress))
                  }

                  const publicKey = toHex(new Uint8Array(buf)) as HexString

                  return of({
                    publicKey,
                    evm: [
                      {
                        chainId,
                        address: evmAddress,
                      },
                    ],
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

export function getStablePoolAddress(id: number): [HexString, HexString] {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32LE(id)
  const name = Buffer.concat([sts, new Uint8Array(bytes)])
  const poolKey = blake2b(new Uint8Array(name), {
    dkLen: 32,
  })
  const evmPoolKey = poolKey.subarray(0, 20)
  return [toHex(poolKey) as HexString, toHex(evmPoolKey) as HexString]
}

function hydrationStableswapAccounts$(ingress: SubstrateIngressConsumer): Observable<SubstrateAccountUpdate> {
  const chainId = networks.hydration
  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('Stableswap', 'Pools')
      const hashers = apiCtx.getHashers('Stableswap', 'Pools')
      const prefix = codec.keys.enc() as HexString
      return storageKeysAtLatest$(ingress, chainId, prefix).pipe(
        concatMap((storageKeys) =>
          ingress.queryStorageAt(chainId, storageKeys).pipe(
            mergeMap((changeSets) => {
              const changes = changeSets[0]?.changes ?? []

              return from(storageKeys).pipe(
                mergeMap((storageKey) => {
                  const change = changes.find(([k]) => k === storageKey)
                  if (!change) {
                    return EMPTY
                  }

                  const poolIdHex = itemKeyFromStorageKey(storageKey, prefix, hashers)
                  const bytes = Buffer.from(poolIdHex.slice(2), 'hex')
                  const poolId = bytes.readUInt32LE(0)
                  const [publicKey, evmAddress] = getStablePoolAddress(poolId)

                  return of({
                    publicKey,
                    evm: [
                      {
                        chainId,
                        address: evmAddress,
                      },
                    ],
                    categories: [
                      {
                        chainId,
                        categoryCode: 2,
                        subCategoryCode: 1,
                      },
                    ],
                    tags: [{ chainId, tag: `protocol:stableswap-${poolId}` }],
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

function hydrationXykAccounts$(ingress: SubstrateIngressConsumer): Observable<SubstrateAccountUpdate> {
  const chainId = networks.hydration
  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('XYK', 'PoolAssets')
      const hashers = apiCtx.getHashers('XYK', 'PoolAssets')
      const prefix = codec.keys.enc() as HexString
      return storageKeysAtLatest$(ingress, chainId, prefix).pipe(
        mergeMap((storageKeys) =>
          storageKeys.map((key) => {
            const publicKey = itemKeyFromStorageKey(key, prefix, hashers)
            const evmAddress = publicKey.slice(0, 42) as HexString

            return {
              publicKey,
              evm: [
                {
                  chainId,
                  address: evmAddress,
                },
              ],
              categories: [
                {
                  chainId,
                  categoryCode: 2,
                  subCategoryCode: 1,
                },
              ],
              tags: [{ chainId, tag: `protocol:xyk` }],
            }
          }),
        ),
      )
    }),
  )
}

function hydrationATokenAccounts$(ingress: SubstrateIngressConsumer): Observable<SubstrateAccountUpdate> {
  const chainId = networks.hydration

  return ingress.getContext(chainId).pipe(
    take(1),
    switchMap((apiCtx) =>
      from(
        ingress.runtimeCall<[number, number][]>(
          chainId,
          {
            api: 'AaveTradeExecutor',
            method: 'pairs',
          },
          [],
        ),
      ).pipe(
        filter((pairs): pairs is [number, number][] => pairs !== null),
        switchMap((pairs) => {
          const locationCodec = apiCtx.storageCodec('AssetRegistry', 'AssetLocations')
          const locationHashers = apiCtx.getHashers('AssetRegistry', 'AssetLocations')
          const locationPrefix = locationCodec.keys.enc() as HexString

          const assetCodec = apiCtx.storageCodec('AssetRegistry', 'Assets')
          const assetHashers = apiCtx.getHashers('AssetRegistry', 'Assets')
          const assetPrefix = assetCodec.keys.enc() as HexString

          const aTokens = new Set(pairs.map(([, a]) => a))

          const assets$ = storageKeysAtLatest$(ingress, chainId, assetPrefix).pipe(
            concatMap((storageKeys) =>
              ingress.queryStorageAt(chainId, storageKeys).pipe(
                map((changeSets) => {
                  const changes = changeSets[0]?.changes ?? []
                  const map = new Map<number, string>()

                  for (const storageKey of storageKeys) {
                    const change = changes.find(([k]) => k === storageKey)
                    if (!change) {
                      continue
                    }

                    const assetId = itemKeyFromStorageKey(storageKey, assetPrefix, assetHashers)

                    const rawValue = change[1]
                    if (!rawValue) {
                      continue
                    }

                    const decoded = assetCodec.value.dec(rawValue as HexString)

                    map.set(u32.dec(assetId), decoded.symbol)
                  }

                  return map
                }),
              ),
            ),
            reduce((acc, m) => {
              m.forEach((v, k) => acc.set(k, v))
              return acc
            }, new Map<number, string>()),
          )

          return assets$.pipe(
            switchMap((assetSymbols) =>
              storageKeysAtLatest$(ingress, chainId, locationPrefix).pipe(
                concatMap((storageKeys) =>
                  ingress.queryStorageAt(chainId, storageKeys).pipe(
                    mergeMap((changeSets) => {
                      const changes = changeSets[0]?.changes ?? []

                      return from(storageKeys).pipe(
                        mergeMap((storageKey) => {
                          const change = changes.find(([k]) => k === storageKey)
                          const assetId = u32.dec(
                            itemKeyFromStorageKey(storageKey, locationPrefix, locationHashers),
                          )

                          if (!change || !aTokens.has(assetId)) {
                            return EMPTY
                          }

                          const rawValue = change[1]
                          if (!rawValue) {
                            return EMPTY
                          }

                          const location = locationCodec.value.dec(rawValue as HexString)
                          if (
                            location?.parents === 0 &&
                            location?.interior?.type === 'X1' &&
                            location?.interior?.value?.type === 'AccountKey20'
                          ) {
                            const address = (location.interior.value.value.key as FixedSizeBinary<20>).asHex()

                            const symbol = assetSymbols.get(assetId)
                            if (!symbol) {
                              return EMPTY
                            }

                            const update: SubstrateAccountUpdate = {
                              publicKey: address,
                              evm: [
                                {
                                  address,
                                  chainId,
                                },
                              ],
                              categories: [
                                {
                                  chainId,
                                  categoryCode: 2,
                                  subCategoryCode: 1,
                                },
                              ],
                              tags: [
                                {
                                  chainId,
                                  tag: `protocol:atoken-${symbol}`,
                                },
                              ],
                              updatedAt: Date.now(),
                            }

                            return of(update)
                          }
                          return EMPTY
                        }),
                      )
                    }),
                  ),
                ),
              ),
            ),
          )
        }),
      ),
    ),
  )
}

function moonbeamTokenAccounts$(): Observable<SubstrateAccountUpdate> {
  const chainId = networks.moonbeam
  return from(assetOverrides).pipe(
    filter((a) => a.chainId === chainId && typeof a.id === 'string' && a.id.startsWith('0x')),
    map((a) => {
      return {
        publicKey: a.id as HexString,
        evm: [
          {
            chainId,
            address: a.id as HexString,
          },
        ],
        tags: [{ chainId, tag: `protocol:token` }],
      }
    }),
  )
}

export const extraAccountMeta$: Record<
  string,
  (ingress: SubstrateIngressConsumer) => Observable<SubstrateAccountUpdate>
> = {
  [networks.hydration]: (ingress) =>
    merge(
      hydrationEvmAccounts$(ingress),
      hydrationStableswapAccounts$(ingress),
      hydrationXykAccounts$(ingress),
      hydrationATokenAccounts$(ingress),
    ),
  [networks.moonbeam]: () => moonbeamTokenAccounts$(),
}

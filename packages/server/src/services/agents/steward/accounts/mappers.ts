import { blake2b } from '@noble/hashes/blake2'
import { fromHex, toHex } from 'polkadot-api/utils'

import { concatMap, EMPTY, expand, from, merge, mergeMap, Observable, of, switchMap } from 'rxjs'
import { padAccountKey20 } from '@/common/address.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Hashers } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../../common/networks.js'
import { SubstrateAccountMetadata, SubstrateAccountUpdate } from './types.js'

const STORAGE_PAGE_LEN = 100
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

  const tagSet = new Set<string>(persisted.tags ?? [])
  for (const tag of incoming.tags ?? []) {
    if (!tagSet.has(tag)) {
      tagSet.add(tag)
      changed = true
    }
  }
  const tags = Array.from(tagSet)

  if (!changed) {
    return persisted
  }

  return {
    publicKey: incoming.publicKey,
    evm,
    identities,
    tags,
    updatedAt: now,
  }
}

export function identities$(ingress: SubstrateIngressConsumer, chainId: NetworkURN) {
  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) => {
      if (!apiCtx.hasPallet('Identity')) {
        return EMPTY
      }
      const codec = apiCtx.storageCodec('Identity', 'IdentityOf')
      const hashers = apiCtx.getHashers('Identity', 'IdentityOf')
      const prefix = codec.keys.enc() as HexString

      return ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN).pipe(
        expand((keys) =>
          keys.length === STORAGE_PAGE_LEN
            ? ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
            : EMPTY,
        ),
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
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('EVMAccounts', 'AccountExtension')
      const hashers = apiCtx.getHashers('EVMAccounts', 'AccountExtension')
      const prefix = codec.keys.enc() as HexString
      return ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN).pipe(
        expand((keys) =>
          keys.length === STORAGE_PAGE_LEN
            ? ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
            : EMPTY,
        ),
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
                    buf = padAccountKey20(evmAddress)
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

export function getAavePoolAddress(reserve: string, atoken: string): [HexString, HexString] {
  const id = reserve + '/' + atoken
  const name = textEncoder.encode(id)
  const poolKey = blake2b(new Uint8Array(name), {
    dkLen: 32,
  })
  const evmPoolKey = poolKey.subarray(0, 20)
  return [toHex(poolKey) as HexString, toHex(evmPoolKey) as HexString]
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
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('Stableswap', 'Pools')
      const hashers = apiCtx.getHashers('Stableswap', 'Pools')
      const prefix = codec.keys.enc() as HexString
      return ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN).pipe(
        expand((keys) =>
          keys.length === STORAGE_PAGE_LEN
            ? ingress.getStorageKeys(chainId, prefix, STORAGE_PAGE_LEN, keys[keys.length - 1])
            : EMPTY,
        ),
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

                  const poolId = itemKeyFromStorageKey(storageKey, prefix, hashers)
                  const poolIdInt = Number.parseInt(poolId.slice(2), 16)
                  const [publicKey, evmAddress] = getStablePoolAddress(poolIdInt)

                  return of({
                    publicKey,
                    evm: [
                      {
                        chainId,
                        address: evmAddress,
                      },
                    ],
                    tags: [`defi:stableswap-${poolIdInt}`],
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

export const extraAccountMeta$: Record<
  string,
  (ingress: SubstrateIngressConsumer) => Observable<SubstrateAccountUpdate>
> = {
  [networks.hydration]: (ingress) =>
    merge(hydrationEvmAccounts$(ingress), hydrationStableswapAccounts$(ingress)),
}

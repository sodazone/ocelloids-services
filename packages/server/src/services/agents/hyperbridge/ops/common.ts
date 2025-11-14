import * as fzstd from 'fzstd'
import { fromHex, toHex } from 'polkadot-api/utils'
import { encodePacked, keccak256, stringToHex } from 'viem'
import { asAccountId, isEVMAddress, normalizePublicKey } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { NetworkURN } from '@/services/types.js'
import { HyperbridgeSignature } from '../codec.js'
import { toIsmpModule } from '../config.js'
import { FormattedAddress } from '../types.js'

function toNetworkURN(consensus: string, id: string): NetworkURN {
  const normalisedConsensus = consensus.trim().toLowerCase()
  const normalisedId = id.trim().toLowerCase()
  if (normalisedConsensus === 'evm') {
    return `urn:ocn:ethereum:${normalisedId}`
  }
  return `urn:ocn:${normalisedConsensus}:${normalisedId}`
}

export function toFormattedNetwork(arg: string | { type: string; value: number }) {
  if (typeof arg === 'string') {
    const parts = arg.split('-')
    if (parts.length !== 2) {
      throw new Error('Unexpected network string')
    }
    return toNetworkURN(parts[0], parts[1])
  }
  return toNetworkURN(arg.type, arg.value.toString())
}

export function toCommitmentHash({
  source,
  dest,
  nonce,
  timeoutTimestamp,
  from,
  to,
  body,
}: {
  source: string | { type: string; value: number }
  dest: string | { type: string; value: number }
  from: HexString
  to: HexString
  nonce: bigint | string
  timeoutTimestamp: bigint | string
  body: HexString
}) {
  const normalizedSource =
    typeof source === 'string'
      ? source.toUpperCase()
      : `${source.type.toUpperCase()}-${source.value.toString()}`
  const normalizedDest =
    typeof dest === 'string' ? dest.toUpperCase() : `${dest.type.toUpperCase()}-${dest.value.toString()}`

  const packed = encodePacked(
    ['bytes', 'bytes', 'uint64', 'uint64', 'bytes', 'bytes', 'bytes'],
    [
      stringToHex(normalizedSource),
      stringToHex(normalizedDest),
      BigInt(nonce),
      BigInt(timeoutTimestamp),
      from,
      to,
      body,
    ],
  )

  const hash = keccak256(packed)
  return hash
}

export function toFormattedAddresses(address: HexString): FormattedAddress {
  const normalizedKey = normalizePublicKey(address)
  const ismpModule = toIsmpModule(normalizedKey)

  return {
    key: normalizedKey,
    formatted:
      ismpModule !== 'unknown'
        ? ismpModule
        : isEVMAddress(normalizedKey)
          ? undefined
          : asAccountId(normalizedKey, 0), // fetch real prefix
  }
}

export function extractSigner(signer: HexString | Uint8Array): HexString {
  const signerBuf = typeof signer === 'string' ? fromHex(signer) : signer
  if (signerBuf.length > 32) {
    const { tag, value } = HyperbridgeSignature.dec(signerBuf)
    if (tag === 'Evm') {
      return toHex(value.address) as HexString
    }
    return toHex(value.publicKey) as HexString
  }
  return toHex(signerBuf) as HexString
}

export async function decompress(compressed: Uint8Array | HexString, encodedCallSize: number) {
  const buf = typeof compressed === 'string' ? fromHex(compressed) : compressed

  return fzstd.decompress(buf, new Uint8Array(encodedCallSize))
}

export function toTimeoutMillis(timeout: string | bigint | number): number {
  return Number(timeout) * 1000
}

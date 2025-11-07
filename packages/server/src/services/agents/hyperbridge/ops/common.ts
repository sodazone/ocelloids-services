import { encodePacked, keccak256, sliceHex, stringToBytes, stringToHex, toHex } from 'viem'
import { asAccountId, isEVMAddress, normalizePublicKey } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { NetworkURN } from '@/services/types.js'
import { BIFROST_ORACLES, TOKEN_GATEWAYS } from '../config.js'
import { FormattedAddress } from '../types.js'

const MODULE_IDS = {
  TOKEN_GATEWAY: (() => sliceHex(keccak256(stringToBytes('tokengty')), 12))(),
  BIFROST: toHex(stringToBytes('ismp-bnc')),
  SLPX: toHex(stringToBytes('bif-slpx')),
  HYPERBRIDGE: toHex(stringToBytes('HYPR-FEE')),
}

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
  source: string
  dest: string
  from: HexString
  to: HexString
  nonce: bigint | string
  timeoutTimestamp: bigint | string
  body: HexString
}) {
  const packed = encodePacked(
    ['bytes', 'bytes', 'uint64', 'uint64', 'bytes', 'bytes', 'bytes'],
    [stringToHex(source), stringToHex(dest), BigInt(nonce), BigInt(timeoutTimestamp), from, to, body],
  )

  const hash = keccak256(packed)
  return hash
}

export function toIsmpModule(to: HexString) {
  switch (to.toLowerCase()) {
    case MODULE_IDS.TOKEN_GATEWAY.toLowerCase():
      return 'token-gateway'
    case MODULE_IDS.BIFROST.toLowerCase():
      return 'bifrost'
    case MODULE_IDS.SLPX.toLowerCase():
      return 'bifrost-slpx'
    case MODULE_IDS.HYPERBRIDGE.toLowerCase():
      return 'hyperbridge'
    default:
      return 'unknown'
  }
}

export function isTokenGateway(contract: HexString) {
  return TOKEN_GATEWAYS.includes(contract) || toIsmpModule(contract) === 'token-gateway'
}

export function isBifrostOracle(contract: HexString) {
  return BIFROST_ORACLES.includes(contract)
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

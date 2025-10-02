import { AbiFunction, decodeAbiParameters, parseAbiItem } from 'viem'

import { HexString } from '@/lib.js'
import { type RelayerInfo, relayerContracts } from './registry.js'

/**
 * Resolve known relayer infos.
 *
 * @param targetChain Destination chain ID
 * @param targetAddress Relayer target contract address
 * @returns RelayerInfo if known, undefined otherwise
 */
export function getRelayerInfo(targetChain: number, targetAddress: string): RelayerInfo | undefined {
  return relayerContracts[targetChain]?.[targetAddress]
}

/**
 * Decode a known relayer payload.
 *
 * @param relayerInfo Static ABI + token info for this target
 * @param rawPayload Hex string of the payload
 */
export function decodeRelayerPayload(relayerInfo: RelayerInfo, rawPayload: HexString) {
  const abiItem = parseAbiItem(relayerInfo.abi) as AbiFunction

  if (!abiItem.inputs) {
    throw new Error('ABI item has no inputs')
  }

  const abiParameters = abiItem.inputs
  const decodedValues = decodeAbiParameters(abiParameters, rawPayload)
  const decoded: any = {}

  abiParameters.forEach((param, i) => {
    decoded[param.name!] = decodedValues[i]
  })

  return { token: relayerInfo.token, ...decoded }
}

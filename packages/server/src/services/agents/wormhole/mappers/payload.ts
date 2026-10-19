import { deserialize, deserializePayload } from '@wormhole-foundation/sdk-definitions'
import { Hex, toHex } from 'viem'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { chainNameToChainId } from '../../steward/metadata/queries/wormhole.js'
import { moonbeamEnhancers } from '../moonbeam/enhancers.js'

export type PayloadEnhancer = (
  payload: bigint | Uint8Array,
  assetOp: NewAssetOperation,
  journey: NewJourney,
) => void

const Discriminator: Record<number, string> = {
  0x01: 'TokenBridge:Transfer',
  0x03: 'TokenBridge:TransferWithPayload',
} as const

export function deserializeTransferPayload(vaa: string): { payload: Hex; emitterChain?: number } | null {
  try {
    const isHex = vaa.startsWith('0x') || (/^[0-9a-fA-F]+$/.test(vaa) && vaa.length % 2 === 0)

    let vaaBytes: Uint8Array
    let result: { payload: Hex; emitterChain: number | undefined } | null = null

    try {
      vaaBytes = isHex
        ? new Uint8Array(Buffer.from(vaa.startsWith('0x') ? vaa.slice(2) : vaa, 'hex'))
        : new Uint8Array(Buffer.from(vaa, 'base64'))

      const deserialized = deserialize('Uint8Array', vaaBytes)
      result = {
        payload: toHex(deserialized.payload) as Hex,
        emitterChain: chainNameToChainId(deserialized.emitterChain),
      }
    } catch (_e) {
      const alternativeBytes = isHex
        ? new Uint8Array(Buffer.from(vaa, 'base64'))
        : new Uint8Array(Buffer.from(vaa.startsWith('0x') ? vaa.slice(2) : vaa, 'hex'))

      const deserializedFallback = deserialize('Uint8Array', alternativeBytes)
      result = {
        payload: toHex(deserializedFallback.payload) as Hex,
        emitterChain: chainNameToChainId(deserializedFallback.emitterChain),
      }
    }

    return result
  } catch (e) {
    console.error('Failed to deserialize VAA payload', e)
    return null
  }
}

export function decodeTransferPayload(vaa: string | undefined) {
  if (!vaa) {
    return null
  }
  try {
    const vaaBytes = new Uint8Array(Buffer.from(vaa, 'base64'))
    const { payload } = deserialize('Uint8Array', vaaBytes)
    const discriminator = Discriminator[payload[0]]
    if (!discriminator) {
      return null
    }
    return deserializePayload(
      discriminator as 'TokenBridge:Transfer' | 'TokenBridge:TransferWithPayload',
      payload,
    )
  } catch (e) {
    console.error('Failed to decode VAA payload', e)
    return null
  }
}

export function resolvePayloadEnhancer({
  address,
  chain,
}: {
  address: string
  chain: number
}): PayloadEnhancer | null {
  const chainEnhancers = moonbeamEnhancers[chain]
  if (!chainEnhancers) {
    return null
  }
  return chainEnhancers[address.toString()] ?? null
}

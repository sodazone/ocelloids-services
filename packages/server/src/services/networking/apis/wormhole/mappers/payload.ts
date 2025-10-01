import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { deserialize, deserializePayload } from '@wormhole-foundation/sdk-definitions'
import { WormholeIds } from '../chain.js'
import { GMP_PRECOMPILE, enhancer as gmpEnhancer } from '../moonbeam/gmp.js'

export type PayloadEnhancer = (
  payload: bigint | Uint8Array,
  assetOp: NewAssetOperation,
  journey: NewJourney,
) => void

const enhancers: Record<string, Record<string, PayloadEnhancer>> = {
  [WormholeIds.MOONBEAM_ID]: {
    [GMP_PRECOMPILE]: gmpEnhancer,
  },
}

const Discriminator: Record<number, string> = {
  0x01: 'TokenBridge:Transfer',
  0x03: 'TokenBridge:TransferWithPayload',
} as const

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
  const chainEnhancers = enhancers[chain]
  if (!chainEnhancers) {
    return null
  }
  return chainEnhancers[address.toString()] ?? null
}

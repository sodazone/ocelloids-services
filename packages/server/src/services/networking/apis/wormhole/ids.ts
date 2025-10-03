export type WormholeId =
  | {
      chainId: string | number
      emitterAddress: string
      sequence: string | number
    }
  | string

export function normalizeWormholeId(id: WormholeId): string {
  let chainId: string
  let emitterAddress: string
  let sequence: string

  if (typeof id === 'string') {
    const parts = id.split('/')
    if (parts.length !== 3) {
      throw new Error("Expected id in format 'chainId/emitterAddress/sequence'")
    }
    ;[chainId, emitterAddress, sequence] = parts
  } else {
    chainId = String(id.chainId)
    emitterAddress = id.emitterAddress
    sequence = String(id.sequence)
  }

  if (!/^\d+$/.test(chainId)) {
    throw new Error('Invalid chainId')
  }
  if (!/^\d+$/.test(sequence)) {
    throw new Error('Invalid sequence')
  }
  if (!/^[0-9a-fA-Fx]+$/.test(emitterAddress)) {
    throw new Error('Invalid emitterAddress encoding')
  }

  return [encodeURIComponent(chainId), encodeURIComponent(emitterAddress), encodeURIComponent(sequence)].join(
    '/',
  )
}

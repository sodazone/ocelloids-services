import { concat, Hex, keccak256, numberToHex, pad } from 'viem'

/**
 * Extracts encodedNttManagerMessage from raw TransceiverMessage bytes
 * TransceiverMessage Wire Format:
 * - prefix (4b)
 * - sourceNttManager (32b)
 * - recipientNttManager (32b)
 * - nttManagerPayloadLength (2b)
 * - nttManagerPayload (variable)
 */
export function extractEncodedNttManagerMessage(transceiverBytes: Hex): Hex {
  // Offset 68..70 (hex chars 138..142) = nttManagerPayloadLength
  const payloadLenHex = transceiverBytes.slice(138, 142)
  const payloadLength = parseInt(payloadLenHex, 16)

  // Payload starts at byte 70 (hex char index 142)
  const startHex = 142
  const endHex = startHex + payloadLength * 2

  return `0x${transceiverBytes.slice(startHex, endHex)}` as Hex
}

/**
 * Computes nttManagerMessageDigestFromHex(sourceChainId, encodedNttManagerMessage)
 */
export function nttManagerMessageDigestFromHex(sourceChainId: number, encodedNttManagerMessage: Hex): Hex {
  const sourceChainIdHex = pad(numberToHex(sourceChainId), { size: 2 })
  return keccak256(concat([sourceChainIdHex, encodedNttManagerMessage]))
}

export interface NttManagerMessage {
  id: Hex
  sender: Hex
  payload: Hex
}

export function encodeNativeTokenTransfer(params: {
  amount: bigint | string
  decimals: number
  sourceToken: Hex
  to: Hex
  toChain: number
  additionalPayload?: Hex
}): Hex {
  const prefix = '0x994E5454' // Magic: 0x99 + NTT
  const decimalsHex = pad(numberToHex(params.decimals), { size: 1 })
  const amountHex = pad(numberToHex(BigInt(params.amount)), { size: 8 })
  const sourceTokenHex = pad(params.sourceToken, { size: 32 })
  const toHex = pad(params.to, { size: 32 })
  const toChainHex = pad(numberToHex(params.toChain), { size: 2 })

  let encoded = concat([prefix, decimalsHex, amountHex, sourceTokenHex, toHex, toChainHex])

  if (params.additionalPayload && params.additionalPayload !== '0x' && params.additionalPayload !== null) {
    const payloadBytes = (params.additionalPayload.length - 2) / 2
    const lenHex = pad(numberToHex(payloadBytes), { size: 2 })
    encoded = concat([encoded, lenHex, params.additionalPayload])
  }

  return encoded
}

export function encodeNttManagerMessage(m: NttManagerMessage): Hex {
  const payloadByteLength = (m.payload.length - 2) / 2
  const payloadLenHex = pad(numberToHex(payloadByteLength), { size: 2 })

  return concat([pad(m.id, { size: 32 }), pad(m.sender, { size: 32 }), payloadLenHex, m.payload])
}

export function nttManagerMessageDigest(sourceChainId: number, m: NttManagerMessage): Hex {
  const encodedMsg = encodeNttManagerMessage(m)
  const sourceChainIdHex = pad(numberToHex(sourceChainId), { size: 2 })
  return keccak256(concat([sourceChainIdHex, encodedMsg]))
}

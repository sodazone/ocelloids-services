import {
  CustomConversion,
  CustomizableBytes,
  customizableBytes,
  deserializeLayout,
  Layout,
} from '@wormhole-foundation/sdk-base'
import { deserialize, layoutItems } from '@wormhole-foundation/sdk-definitions'
import { normalizePublicKey } from '@/common/util.js'
import { normalizeWormholeId } from '@/services/networking/apis/wormhole/ids.js'
import { PayloadNativeTokenTransfer, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { HexString } from '@/services/subscriptions/types.js'

type Prefix = readonly [number, number, number, number]

const TRANSCEIVER_PREFIX: Prefix = [0x99, 0x45, 0xff, 0x10]

const prefixItem = (prefix: Prefix) =>
  ({
    name: 'prefix',
    binary: 'bytes',
    custom: Uint8Array.from(prefix),
    omit: true,
  }) as const

const optionalAdditionalPayloadItem = {
  binary: 'bytes',
  custom: {
    to: (val: Uint8Array) => {
      if (val.byteLength >= 2) {
        const additionalPayloadLen = deserializeNum(val, 2)
        return val.slice(2, 2 + additionalPayloadLen)
      }
      return new Uint8Array()
    },
    from: (val: Uint8Array) => {
      if (val.byteLength > 0) {
        return new Uint8Array([...serializeNum(val.byteLength, 2), ...val])
      }
      return new Uint8Array()
    },
  } satisfies CustomConversion<Uint8Array, Uint8Array>,
} as const satisfies Layout

const trimmedAmountLayout = [
  { name: 'decimals', binary: 'uint', size: 1 },
  { name: 'amount', binary: 'uint', size: 8 },
] as const satisfies Layout

const trimmedAmountItem = {
  binary: 'bytes',
  layout: trimmedAmountLayout,
} as const

const nativeTokenTransferLayout = [
  prefixItem([0x99, 0x4e, 0x54, 0x54]),
  { name: 'trimmedAmount', ...trimmedAmountItem },
  { name: 'sourceToken', ...layoutItems.universalAddressItem },
  { name: 'recipientAddress', ...layoutItems.universalAddressItem },
  { name: 'recipientChain', binary: 'uint', size: 2 },
  { name: 'additionalPayload', ...optionalAdditionalPayloadItem },
] as const satisfies Layout

const nttManagerMessageLayout = <const P extends CustomizableBytes = undefined>(innerPayload?: P) =>
  [
    { name: 'id', binary: 'bytes', size: 32 },
    { name: 'sender', ...layoutItems.universalAddressItem },
    customizableBytes({ name: 'payload', lengthSize: 2 }, innerPayload),
  ] as const satisfies Layout

const transceiverMessageLayout = <
  const MP extends CustomizableBytes = undefined,
  const TP extends CustomizableBytes = undefined,
>(
  prefix: Prefix,
  nttManagerPayload?: MP,
  transceiverPayload?: TP,
) =>
  [
    prefixItem(prefix),
    { name: 'sourceNttManager', ...layoutItems.universalAddressItem },
    { name: 'recipientNttManager', ...layoutItems.universalAddressItem },
    customizableBytes({ name: 'nttManagerPayload', lengthSize: 2 }, nttManagerPayload),
    customizableBytes({ name: 'transceiverPayload', lengthSize: 2 }, transceiverPayload),
  ] as const satisfies Layout

function deserializeNum(encoded: Uint8Array, size: number): number {
  let val = 0n
  for (let i = 0; i < size; ++i) {
    val |= BigInt(encoded[i]!) << BigInt(8 * (size - i - 1))
  }

  return Number(val)
}

function serializeNum(val: number, size: number): Uint8Array {
  const arr = new Uint8Array(size)
  for (let i = 0; i < size; ++i) {
    arr[i] = Number((BigInt(val) >> BigInt(8 * (size - i - 1))) & 0xffn)
  }
  return arr
}

export function decodeNttFromRawVaa(vaa: string) {
  try {
    const vaaBytes = new Uint8Array(Buffer.from(vaa, 'base64'))
    const { payload } = deserialize('Uint8Array', vaaBytes)

    const fullLayout = transceiverMessageLayout(
      TRANSCEIVER_PREFIX,
      nttManagerMessageLayout(nativeTokenTransferLayout),
    )

    return deserializeLayout(fullLayout, payload)
  } catch (_err) {
    return null
  }
}

export function toNttOp(op: WormholeOperation) {
  const rawVaa = op.vaa?.raw
  if (!rawVaa) {
    throw new Error('No VAA in operation')
  }

  const decodedPayload = decodeNttFromRawVaa(rawVaa)
  if (!decodedPayload) {
    throw new Error('Unable to decode VAA as NTT payload.')
  }

  const {
    nttManagerPayload: { id, payload, sender },
    recipientNttManager,
    sourceNttManager,
    transceiverPayload,
  } = decodedPayload
  const amount = payload.trimmedAmount.amount.toString()
  const fromAddress = sender.toString()
  const decimals = payload.trimmedAmount.decimals
  const to = payload.recipientAddress.toString()
  const toChain = payload.recipientChain
  const sourceToken = payload.sourceToken.toString()

  const enrichedOp = op as unknown as WormholeOperation<PayloadNativeTokenTransfer>
  enrichedOp.content.payload = {
    nttManagerMessage: {
      id: Buffer.from(id).toString('hex'),
      sender: fromAddress,
    },
    nttMessage: {
      additionalPayload: Buffer.from(payload.additionalPayload).toString('hex'),
      sourceToken,
      to,
      toChain,
      trimmedAmount: {
        amount,
        decimals,
      },
    },
    transceiverMessage: {
      prefix: Buffer.from(TRANSCEIVER_PREFIX).toString('hex'),
      recipientNttManager: recipientNttManager.toString(),
      sourceNttManager: sourceNttManager.toString(),
      transceiverPayload: Buffer.from(transceiverPayload).toString('hex'),
    },
  }

  enrichedOp.content.standarizedProperties = {
    ...enrichedOp.content.standarizedProperties,
    amount,
    fromAddress: normalizePublicKey(fromAddress as HexString),
    normalizedDecimals: decimals,
    toAddress: normalizePublicKey(to as HexString),
    toChain,
    tokenAddress: normalizePublicKey(sourceToken as HexString),
  }

  const { fromChain } = enrichedOp.content.standarizedProperties
  if (fromChain === 0 || fromChain === undefined) {
    const whid = normalizeWormholeId(op.id)
    const [sourceChain, _emitterAddress, _sequence] = whid.split('/')
    const sourceChainId = Number(sourceChain)
    enrichedOp.content.standarizedProperties.fromChain = sourceChainId
    enrichedOp.content.standarizedProperties.tokenChain = sourceChainId
  }

  return enrichedOp
}

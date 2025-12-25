import { Abi, decodeFunctionData, hexToBigInt, hexToNumber, sliceHex } from 'viem'
import { normalizePublicKey } from '@/common/util.js'

const payload =
  '0x03000000000000000000000000000000000000000000000000000000002d4cae00000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480002000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0002000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca010000000000000000000000000000000000000000000000000000000000086d230000000000000000000000000000000000000000000000000000000000000000000000000000000000000000bd57db4628e46b2558305373fae1714254d9f572' as `0x${string}`
const callData =
  '0x96e292b8000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000931715fee2d06333043d11f658c8ce934ac61d0c000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000cafd2f0a35a4459fa40c0517e17e6fa2939441ca0000000000000000000000000000000000000000000000000000001703e975540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c41019d654000000000000000000000000931715fee2d06333043d11f658c8ce934ac61d0c0000000000000000000000000000000000000000000000000000001703e9755400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000b5fb748ec3e019a7ed4f6f701158bc23fa3a26260000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
const relayerCall =
  '0x1019d65400000000000000000000000099fec54a5ad36d50a4bba3a41cab983a5bb86a7d0000000000000000000000000000000000000000000000000000000f009544e90000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000122e929ae84b3bd96679c12c4d3b329bfb8d3e4b9846927e1ca339220a6ab600c0000000000000000000000000000000000000000000000000000000000000000'

const batchPrecompileAbi = [
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 'SubcallFailed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 'SubcallSucceeded',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'to', type: 'address[]' },
      { internalType: 'uint256[]', name: 'value', type: 'uint256[]' },
      { internalType: 'bytes[]', name: 'callData', type: 'bytes[]' },
      { internalType: 'uint64[]', name: 'gasLimit', type: 'uint64[]' },
    ],
    name: 'batchAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'to', type: 'address[]' },
      { internalType: 'uint256[]', name: 'value', type: 'uint256[]' },
      { internalType: 'bytes[]', name: 'callData', type: 'bytes[]' },
      { internalType: 'uint64[]', name: 'gasLimit', type: 'uint64[]' },
    ],
    name: 'batchSome',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'to', type: 'address[]' },
      { internalType: 'uint256[]', name: 'value', type: 'uint256[]' },
      { internalType: 'bytes[]', name: 'callData', type: 'bytes[]' },
      { internalType: 'uint64[]', name: 'gasLimit', type: 'uint64[]' },
    ],
    name: 'batchSomeUntilFailure',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as Abi

const whRelayer = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenBridge_', type: 'address' },
      { internalType: 'address', name: 'wethAddress', type: 'address' },
      { internalType: 'address', name: 'feeRecipient_', type: 'address' },
      { internalType: 'address', name: 'ownerAssistant_', type: 'address' },
      { internalType: 'bool', name: 'unwrapWeth_', type: 'bool' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'oldRecipient', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newRecipient', type: 'address' },
    ],
    name: 'FeeRecipientUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'oldOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransfered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'recipient', type: 'address' },
      { indexed: true, internalType: 'address', name: 'relayer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'nativeAmount', type: 'uint256' },
    ],
    name: 'SwapExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
        ],
        indexed: true,
        internalType: 'struct TokenBridgeRelayerStructs.SwapRateUpdate[]',
        name: 'swapRates',
        type: 'tuple[]',
      },
    ],
    name: 'SwapRateUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint16', name: 'emitterChainId', type: 'uint16' },
      { indexed: true, internalType: 'bytes32', name: 'emitterAddress', type: 'bytes32' },
      { indexed: true, internalType: 'uint64', name: 'sequence', type: 'uint64' },
    ],
    name: 'TransferRedeemed',
    type: 'event',
  },
  {
    inputs: [],
    name: 'VERSION',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WETH',
    outputs: [{ internalType: 'contract IWETH', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'calculateMaxSwapAmountIn',
    outputs: [{ internalType: 'uint256', name: 'maxAllowed', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'toNativeAmount', type: 'uint256' },
    ],
    name: 'calculateNativeSwapAmountOut',
    outputs: [{ internalType: 'uint256', name: 'nativeAmount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'targetChainId', type: 'uint16' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
    ],
    name: 'calculateRelayerFee',
    outputs: [{ internalType: 'uint256', name: 'feeInTokenDenomination', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint16', name: 'chainId_', type: 'uint16' }],
    name: 'cancelOwnershipTransferRequest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'chainId',
    outputs: [{ internalType: 'uint16', name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'encodedTransferMessage', type: 'bytes' }],
    name: 'completeTransferWithRelay',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'confirmOwnershipTransferRequest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'encoded', type: 'bytes' }],
    name: 'decodeTransferWithRelay',
    outputs: [
      {
        components: [
          { internalType: 'uint8', name: 'payloadId', type: 'uint8' },
          { internalType: 'uint256', name: 'targetRelayerFee', type: 'uint256' },
          { internalType: 'uint256', name: 'toNativeTokenAmount', type: 'uint256' },
          { internalType: 'bytes32', name: 'targetRecipient', type: 'bytes32' },
        ],
        internalType: 'struct TokenBridgeRelayerStructs.TransferWithRelay',
        name: 'transfer',
        type: 'tuple',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
    ],
    name: 'denormalizeAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'deregisterToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint8', name: 'payloadId', type: 'uint8' },
          { internalType: 'uint256', name: 'targetRelayerFee', type: 'uint256' },
          { internalType: 'uint256', name: 'toNativeTokenAmount', type: 'uint256' },
          { internalType: 'bytes32', name: 'targetRecipient', type: 'bytes32' },
        ],
        internalType: 'struct TokenBridgeRelayerStructs.TransferWithRelay',
        name: 'transfer',
        type: 'tuple',
      },
    ],
    name: 'encodeTransferWithRelay',
    outputs: [{ internalType: 'bytes', name: 'encoded', type: 'bytes' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeRecipient',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'payload', type: 'bytes' }],
    name: 'fetchLocalAddressFromTransferMessage',
    outputs: [{ internalType: 'address', name: 'localAddress', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAcceptedTokensList',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPaused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint16', name: 'emitterChainId', type: 'uint16' }],
    name: 'getRegisteredContract',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'isAcceptedToken',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'maxNativeSwapAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'nativeSwapRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
    ],
    name: 'normalizeAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'ownerAssistant',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'bytes32', name: 'contractAddress', type: 'bytes32' },
    ],
    name: 'registerContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'registerToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint16', name: 'chainId_', type: 'uint16' }],
    name: 'relayerFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'relayerFeePrecision',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'bool', name: 'paused', type: 'bool' },
    ],
    name: 'setPauseForTransfers',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'submitOwnershipTransferRequest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'swapRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'swapRatePrecision',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenBridge',
    outputs: [{ internalType: 'contract ITokenBridge', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'toNativeTokenAmount', type: 'uint256' },
      { internalType: 'uint16', name: 'targetChain', type: 'uint16' },
      { internalType: 'bytes32', name: 'targetRecipient', type: 'bytes32' },
      { internalType: 'uint32', name: 'batchId', type: 'uint32' },
    ],
    name: 'transferTokensWithRelay',
    outputs: [{ internalType: 'uint64', name: 'messageSequence', type: 'uint64' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unwrapWeth',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'newFeeRecipient', type: 'address' },
    ],
    name: 'updateFeeRecipient',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'maxAmount', type: 'uint256' },
    ],
    name: 'updateMaxNativeSwapAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'address', name: 'newAssistant', type: 'address' },
    ],
    name: 'updateOwnerAssistant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'updateRelayerFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'uint256', name: 'relayerFeePrecision_', type: 'uint256' },
    ],
    name: 'updateRelayerFeePrecision',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
        ],
        internalType: 'struct TokenBridgeRelayerStructs.SwapRateUpdate[]',
        name: 'swapRateUpdate',
        type: 'tuple[]',
      },
    ],
    name: 'updateSwapRate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'uint256', name: 'swapRatePrecision_', type: 'uint256' },
    ],
    name: 'updateSwapRatePrecision',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'chainId_', type: 'uint16' },
      { internalType: 'bool', name: 'unwrapWeth_', type: 'bool' },
    ],
    name: 'updateUnwrapWethFlag',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'wormhole',
    outputs: [{ internalType: 'contract IWormhole', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'toNativeTokenAmount', type: 'uint256' },
      { internalType: 'uint16', name: 'targetChain', type: 'uint16' },
      { internalType: 'bytes32', name: 'targetRecipient', type: 'bytes32' },
      { internalType: 'uint32', name: 'batchId', type: 'uint32' },
    ],
    name: 'wrapAndTransferEthWithRelay',
    outputs: [{ internalType: 'uint64', name: 'messageSequence', type: 'uint64' }],
    stateMutability: 'payable',
    type: 'function',
  },
  { stateMutability: 'payable', type: 'receive' },
] as Abi

export function decodeTransferWithPayload(payload: `0x${string}`) {
  let offset = 0

  const payloadID = hexToNumber(sliceHex(payload, offset, offset + 1))
  offset += 1

  const amount = hexToBigInt(sliceHex(payload, offset, offset + 32))
  offset += 32

  const tokenAddress = sliceHex(payload, offset, offset + 32)
  offset += 32

  const tokenChain = hexToNumber(sliceHex(payload, offset, offset + 2))
  offset += 2

  const to = sliceHex(payload, offset, offset + 32)
  offset += 32

  const toChain = hexToNumber(sliceHex(payload, offset, offset + 2))
  offset += 2

  const fromAddress = sliceHex(payload, offset, offset + 32)
  offset += 32

  const appPayload = sliceHex(payload, offset)

  return {
    payloadID,
    amount,
    tokenAddress,
    tokenChain,
    to,
    toChain,
    fromAddress,
    payload: appPayload,
  }
}

export function decodeTransferWithRelay(payload: `0x${string}`) {
  let offset = 0

  // payloadId (uint8)
  const payloadId = hexToNumber(sliceHex(payload, offset, offset + 1))
  offset += 1

  if (payloadId !== 1) {
    throw new Error('invalid payloadId')
  }

  // targetRelayerFee (uint256)
  const targetRelayerFee = hexToBigInt(sliceHex(payload, offset, offset + 32))
  offset += 32

  // toNativeTokenAmount (uint256)
  const toNativeTokenAmount = hexToBigInt(sliceHex(payload, offset, offset + 32))
  offset += 32

  // targetRecipient (bytes32)
  const targetRecipient = sliceHex(payload, offset, offset + 32)
  offset += 32

  if (offset !== (payload.length - 2) / 2) {
    throw new Error('invalid message length')
  }

  return {
    payloadId,
    targetRelayerFee,
    toNativeTokenAmount,
    targetRecipient,
  }
}

const outer = decodeTransferWithPayload(payload)
const relay = decodeTransferWithRelay(outer.payload)

console.log({
  amount: outer.amount,
  toChain: outer.toChain,
  token: normalizePublicKey(outer.tokenAddress),
  recipient: normalizePublicKey(relay.targetRecipient),
})

const decodedBatch = decodeFunctionData({ abi: batchPrecompileAbi, data: callData })
console.log('BATCH', decodedBatch)

const decodedCall = decodeFunctionData({ abi: whRelayer, data: relayerCall })
console.log(decodedCall)

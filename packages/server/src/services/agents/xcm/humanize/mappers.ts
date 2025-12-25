import { Binary } from 'polkadot-api'
import { decodeFunctionData } from 'viem'
import { HexString } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import batchPrecompileAbi from '../abis/moonbeam-batch.json' with { type: 'json' }
import TokenRelayerAbi from '../abis/wh-token-relayer.json' with { type: 'json' }
import { HumanizedTransactCall } from './types.js'

const MOONBEAM_BATCH_PRECOMPILE = '0x0000000000000000000000000000000000000808'
const TOKEN_BRIDGE_RELAYER = '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca'

type EthereumXcmTransact = {
  xcm_transaction: {
    type: string
    value: {
      gas_limit: bigint[]
      fee_payment: { type: string; value?: any }
      action: {
        type: string
        value: Binary
      }
      value: bigint[]
      input: Binary
      access_list?: any
    }
  }
}

type XprotocolArgs = {
  type: 'wormhole'
  protocol: string
  recipient: HexString
  destination: number
  assets: [
    {
      id: HexString
      amount: bigint
    },
  ]
}

type XprotocolMapping = (args: AnyJson) => XprotocolArgs | null

const xprotocolArgsMappers: Record<NetworkURN, Record<string, XprotocolMapping>> = {
  'urn:ocn:polkadot:2004': {
    'ethereumxcm.transact': (args) => {
      const {
        xcm_transaction: { value },
      } = args as unknown as EthereumXcmTransact

      if (value.action.type === 'Call' && value.action.value.asHex() === MOONBEAM_BATCH_PRECOMPILE) {
        const decodedBatch = decodeFunctionData({ abi: batchPrecompileAbi, data: value.input.asHex() })
        if (decodedBatch.args) {
          const [contract, _value, input] = decodedBatch.args
          const contracts = Array.isArray(contract) ? contract : [contract]
          const inputs = Array.isArray(input) ? input : [input]
          const wormholeCallIndex = contracts.findIndex((c) => c.toLowerCase() === TOKEN_BRIDGE_RELAYER)
          if (wormholeCallIndex > 0 && inputs.length >= wormholeCallIndex) {
            const relayerCall = inputs[wormholeCallIndex]
            const decodedCall = decodeFunctionData({ abi: TokenRelayerAbi, data: relayerCall })
            if (decodedCall.args) {
              const [token, amount, _toNativeTokenAmount, destination, recipient, _batchId] =
                decodedCall.args as [HexString, bigint, bigint, number, HexString, number]
              return {
                type: 'wormhole',
                protocol: 'wh_portal',
                recipient,
                destination,
                assets: [
                  {
                    id: token,
                    amount,
                  },
                ],
              }
            }
          }
        }
      }

      return null
    },
  },
}

export function getXprotocolArgsMapper(
  chainId: NetworkURN,
  call: HumanizedTransactCall,
): XprotocolMapping | null {
  const chainMappers = xprotocolArgsMappers[chainId]
  if (!chainMappers) {
    return null
  }
  const key = `${call.module?.toLowerCase()}.${call.method?.toLowerCase()}`
  const mapper = chainMappers[key]
  if (!mapper) {
    return null
  }
  return mapper
}

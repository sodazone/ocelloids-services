import {
  Abi,
  decodeEventLog,
  decodeFunctionData,
  keccak256,
  recoverAddress,
  Signature,
  serializeTransaction,
  TransactionSerializable,
  TransactionSerializableEIP1559,
  TransactionSerializableEIP2930,
  TransactionSerializableEIP7702,
} from 'viem'

import { HexString } from '@/lib.js'
import { Event, Extrinsic } from '../types.js'

type FrontierTransactionTypes = Legacy | EIP1559 | EIP2930 | EIP7702
export type FrontierExtrinsic = {
  transaction: FrontierTransactionTypes
}

type BigNumStringArray = string[]
type AccessList = {
  address: HexString
  storage_keys: HexString[]
}

type FrontierAuthorization = {
  chain_id: string
  address: HexString
  nonce: BigNumStringArray
  signature: {
    odd_y_parity: boolean
    r: HexString
    s: HexString
  }
}

type FrontierEIP1559Value = {
  chain_id: string
  nonce: BigNumStringArray
  max_priority_fee_per_gas: BigNumStringArray
  max_fee_per_gas: BigNumStringArray
  gas_limit: BigNumStringArray
  action: {
    type: string
    value: HexString
  }
  value: BigNumStringArray
  input: HexString
  access_list: AccessList[]
}

type FrontierEIP2930Value = {
  chain_id: string
  nonce: BigNumStringArray
  gas_limit: BigNumStringArray
  gas_price: BigNumStringArray
  action: {
    type: string
    value: HexString
  }
  value: BigNumStringArray
  input: HexString
  access_list: AccessList[]
}

type FrontierEIP7702Value = {
  chain_id: string
  nonce: BigNumStringArray
  max_priority_fee_per_gas: BigNumStringArray
  max_fee_per_gas: BigNumStringArray
  gas_limit: BigNumStringArray
  destination: {
    type: string
    value: HexString
  }
  value: BigNumStringArray
  data: HexString
  access_list: AccessList[]
  authorization_list: FrontierAuthorization[]
  signature: {
    odd_y_parity: boolean
    r: HexString
    s: HexString
  }
}

type EIP7702 = {
  type: 'EIP7702'
  value: FrontierEIP7702Value
}

type Legacy = {
  type: 'Legacy'
  value: {
    nonce: BigNumStringArray
    gas_limit: BigNumStringArray
    gas_price: BigNumStringArray
    value: BigNumStringArray
    input: HexString
    action: {
      type: string
      value: HexString
    }
    signature: {
      v: string
      r: HexString
      s: HexString
    }
  }
}

type EIP1559 = {
  type: 'EIP1559'
  value:
    | (FrontierEIP1559Value & {
        odd_y_parity: boolean
        r: HexString
        s: HexString
      })
    | (FrontierEIP1559Value & {
        signature: {
          odd_y_parity: boolean
          r: HexString
          s: HexString
        }
      })
}

type EIP2930 = {
  type: 'EIP2930'
  value:
    | (FrontierEIP2930Value & {
        odd_y_parity: boolean
        r: HexString
        s: HexString
      })
    | (FrontierEIP2930Value & {
        signature: {
          odd_y_parity: boolean
          r: HexString
          s: HexString
        }
      })
}

function u256(parts: string[]): bigint {
  return (
    BigInt(parts[0] ?? 0) +
    (BigInt(parts[1] ?? 0) << 64n) +
    (BigInt(parts[2] ?? 0) << 128n) +
    (BigInt(parts[3] ?? 0) << 192n)
  )
}

function extractTxAndSig(
  tx: FrontierTransactionTypes,
): [
  (
    | TransactionSerializable
    | TransactionSerializableEIP2930
    | TransactionSerializableEIP1559
    | TransactionSerializableEIP7702
  ),
  Signature,
] {
  switch (tx.type) {
    case 'Legacy': {
      const v = tx.value

      const nonce = u256(v.nonce)
      const value = u256(v.value)
      const gas = u256(v.gas_limit)
      const gasPrice = u256(v.gas_price)

      return [
        {
          nonce: Number(nonce),
          value,
          type: 'legacy',
          data: v.input,
          to: v.action.value,
          gas,
          gasPrice,
        } as TransactionSerializable,
        {
          r: v.signature.r,
          s: v.signature.s,
          v: BigInt(v.signature.v),
        },
      ]
    }

    case 'EIP1559': {
      const v = tx.value

      const sig =
        'signature' in v
          ? {
              r: v.signature.r!,
              s: v.signature.s!,
              yParity: v.signature.odd_y_parity ? 1 : 0,
            }
          : {
              r: v.r!,
              s: v.s!,
              yParity: v.odd_y_parity ? 1 : 0,
            }

      return [
        {
          chainId: Number(v.chain_id),
          nonce: Number(u256(v.nonce)),
          value: u256(v.value),
          type: 'eip1559',
          data: v.input,
          to: v.action.value,
          gas: u256(v.gas_limit),
          maxFeePerGas: u256(v.max_fee_per_gas),
          maxPriorityFeePerGas: u256(v.max_priority_fee_per_gas),
          accessList: v.access_list?.map(({ address, storage_keys }) => ({
            address,
            storageKeys: storage_keys,
          })),
        } as TransactionSerializableEIP1559,

        sig,
      ]
    }

    case 'EIP2930': {
      const v = tx.value

      const sig =
        'signature' in v
          ? {
              r: v.signature.r!,
              s: v.signature.s!,
              yParity: v.signature.odd_y_parity ? 1 : 0,
            }
          : {
              r: v.r!,
              s: v.s!,
              yParity: v.odd_y_parity ? 1 : 0,
            }

      return [
        {
          chainId: Number(v.chain_id),
          nonce: Number(u256(v.nonce)),
          gas: u256(v.gas_limit),
          gasPrice: u256(v.gas_price),
          value: u256(v.value),
          accessList: v.access_list?.map(({ address, storage_keys }) => ({
            address,
            storageKeys: storage_keys,
          })),
          type: 'eip2930',
          data: v.input,
          to: v.action.value,
        } as TransactionSerializableEIP2930,

        sig,
      ]
    }

    case 'EIP7702': {
      const v = tx.value

      const sig = {
        r: v.signature.r,
        s: v.signature.s,
        yParity: v.signature.odd_y_parity ? 1 : 0,
      }

      return [
        {
          type: 'eip7702',
          chainId: Number(v.chain_id),
          nonce: Number(u256(v.nonce)),
          gas: u256(v.gas_limit),
          maxFeePerGas: u256(v.max_fee_per_gas),
          maxPriorityFeePerGas: u256(v.max_priority_fee_per_gas),
          value: u256(v.value),
          data: v.data,
          to: v.destination.type === 'Call' ? v.destination.value : undefined,
          accessList: v.access_list?.map(({ address, storage_keys }) => ({
            address,
            storageKeys: storage_keys,
          })),
          authorizationList: v.authorization_list.map((auth) => ({
            chainId: Number(auth.chain_id),
            address: auth.address,
            nonce: Number(u256(auth.nonce)),
            yParity: auth.signature.odd_y_parity ? 1 : 0,
            r: auth.signature.r,
            s: auth.signature.s,
          })),
        } as TransactionSerializableEIP7702,

        sig,
      ]
    }

    default:
      throw new Error('Unknown transaction type')
  }
}

export function isEVMLog(event: Event) {
  return event.module === 'EVM' && event.name === 'Log'
}

export function isFrontierExtrinsic(xt: Extrinsic) {
  return xt.module === 'Ethereum' && xt.method === 'transact'
}

export function decodeEvmFunctionData({ data, abi }: { data: HexString; abi: Abi }) {
  try {
    return decodeFunctionData({ data, abi })
  } catch {
    //
  }
}

export function decodeEvmEventLog({
  data,
  topics,
  abi,
}: {
  data?: HexString
  topics: [HexString]
  abi: Abi
}) {
  try {
    return decodeEventLog({ data, topics, abi })
  } catch {
    //
  }
}

export function getTxHash(xt: FrontierExtrinsic) {
  const envelope = xt?.transaction
  const [tx, sig] = extractTxAndSig(envelope)
  const stx = serializeTransaction(tx, sig)
  return keccak256(stx)
}

export async function getFromAddress(xt: FrontierExtrinsic) {
  const envelope = xt?.transaction
  switch (envelope?.type) {
    case 'Legacy': {
      const [tx, sig] = extractTxAndSig(envelope)
      const v = Number(sig.v)

      let stx
      let signature
      let yParity

      if (v === 27 || v === 28) {
        stx = serializeTransaction(tx)
        signature = {
          r: sig.r,
          s: sig.s,
          v: BigInt(v),
        }
      } else {
        const chainId = ((v - 35) / 2) | 0
        yParity = v - (chainId * 2 + 35)
        stx = serializeTransaction({
          ...tx,
          chainId,
        })
        signature = {
          r: sig.r,
          s: sig.s,
          yParity,
        }
      }

      const hash = keccak256(stx)
      const from = await recoverAddress({
        hash,
        signature,
      })

      return from
    }
    case 'EIP1559':
    case 'EIP2930':
    case 'EIP7702': {
      const [tx, signature] = extractTxAndSig(envelope)
      const stx = serializeTransaction(tx)
      const hash = keccak256(stx)
      const from = await recoverAddress({
        hash,
        signature,
      })

      return from
    }
    default:
      throw new Error('Unknown transaction type')
  }
}

export function isEIP7702(obj: any): obj is EIP7702 {
  return 'type' in obj && obj.type === 'EIP7702'
}

import {
  Abi,
  Signature,
  TransactionSerializable,
  TransactionSerializableEIP1559,
  TransactionSerializableEIP2930,
  decodeEventLog,
  decodeFunctionData,
  keccak256,
  recoverAddress,
  serializeTransaction,
} from 'viem'

import { HexString } from '@/lib.js'
import { Event, Extrinsic } from '@/services/networking/types.js'

export type FrontierExtrinsic = {
  transaction: Legacy | EIP1559 | EIP2930
}

type BigNumStringArray = string[]
type AccessList = {
  address: HexString
  storage_keys: HexString[]
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
  value: {
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
    odd_y_parity: boolean
    r: HexString
    s: HexString
  }
}

type EIP2930 = {
  type: 'EIP2930'
  value: {
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
    odd_y_parity: boolean
    r: HexString
    s: HexString
  }
}

function extractTxAndSig(
  tx: Legacy | EIP1559 | EIP2930,
): [TransactionSerializable | TransactionSerializableEIP2930 | TransactionSerializableEIP1559, Signature] {
  switch (tx.type) {
    case 'Legacy': {
      const v = tx.value
      return [
        {
          nonce: Number(v.nonce[0]),
          value: BigInt(v.value[0]),
          type: 'legacy',
          data: v.input,
          to: v.action.value,
          gas: BigInt(v.gas_limit[0]),
          gasPrice: BigInt(v.gas_price[0]),
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
      return [
        {
          chainId: Number(v.chain_id),
          nonce: Number(v.nonce[0]),
          value: BigInt(v.value[0]),
          type: 'eip1559',
          data: v.input,
          to: v.action.value,
          gas: BigInt(v.gas_limit[0]),
          maxFeePerGas: BigInt(v.max_fee_per_gas[0]),
          maxPriorityFeePerGas: BigInt(v.max_priority_fee_per_gas[0]),
        } as TransactionSerializableEIP1559,
        {
          r: v.r!,
          s: v.s!,
          yParity: v.odd_y_parity ? 1 : 0,
        },
      ]
    }
    case 'EIP2930': {
      const v = tx.value
      console.log(v)
      return [
        {
          chainId: Number(v.chain_id),
          nonce: Number(v.nonce[0]),
          gas: BigInt(v.gas_limit[0]),
          gasPrice: BigInt(v.gas_price[0]),
          value: BigInt(v.value[0]),
          accessList: v.access_list.map(({ address, storage_keys }) => ({
            address,
            storageKeys: storage_keys,
          })),
          type: 'eip2930',
          data: v.input,
          to: v.action.value,
        } as TransactionSerializableEIP2930,
        {
          r: v.r!,
          s: v.s!,
          yParity: v.odd_y_parity ? 1 : 0,
        },
      ]
    }
    default:
      throw new Error('Unkwnon transaction type')
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
    case 'EIP2930': {
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

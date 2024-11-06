import { Signature, TransactionSerializable, keccak256, recoverAddress, serializeTransaction } from 'viem'

import { HexString } from '@/lib.js'

export type FrontierExtrinsic = {
  transaction: Legacy | EIP1559
}

type BigNumStringArray = string[]

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
    access_list: string[]
    odd_y_parity: boolean
    r: HexString
    s: HexString
  }
}

function extractTxAndSig(tx: Legacy | EIP1559): [TransactionSerializable, Signature] {
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
        },
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
        },
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
      const inferredChainId = ((v - 35) / 2) | 0
      const stx = serializeTransaction({
        ...tx,
        chainId: inferredChainId,
      })
      const signature = {
        r: sig.r,
        s: sig.s,
        yParity: v - (inferredChainId * 2 + 35),
      }
      const hash = keccak256(stx)
      const from = await recoverAddress({
        hash,
        signature,
      })

      return from
    }
    case 'EIP1559': {
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
      throw new Error('Unkwnon transaction type')
  }
}

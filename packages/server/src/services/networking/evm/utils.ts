import { Abi, AbiEvent, toEventSelector } from 'viem'
import { DecodedTxWithReceipt } from './types.js'

export function findLogInTx(tx: DecodedTxWithReceipt, abi: Abi, eventName: string) {
  const selectors = abi
    .filter((item) => item.type === 'event' && item.name.toLowerCase() === eventName.toLowerCase())
    .map((ev) => toEventSelector(ev as AbiEvent))

  const found = tx.receipt.logs.find((log) => {
    const { topics, data } = log
    const topic0 = topics[0]
    if (typeof topic0 === 'undefined' || !selectors.includes(topic0) || data === '0x') {
      return false
    }
    return true
  })

  return found
}

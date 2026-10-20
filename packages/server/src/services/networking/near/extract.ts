import { mergeMap, Observable } from 'rxjs'
import { bytesToHex, hexToString, parseTransaction, TransactionSerializable } from 'viem'
import { NearBlock, NearTransaction, NearTxStatus } from './types.js'

function decodeRlpExecuteTransaction(txB64: string): TransactionSerializable | null {
  const rawBytes = new Uint8Array(Buffer.from(txB64, 'base64'))
  const hexTx = bytesToHex(rawBytes)

  try {
    const parsedTx = parseTransaction(hexTx)
    return parsedTx
  } catch (_error) {
    return null
  }
}

function extractNearAction(parsedTx: ReturnType<typeof parseTransaction>) {
  if (!parsedTx.data || parsedTx.data === '0x') {
    throw new Error('Transaction data is empty')
  }

  const rawString = hexToString(parsedTx.data)

  const targetMatch = rawString.match(/[a-zA-Z0-9_-]+\.near/)
  const target = targetMatch ? targetMatch[0] : null

  const words = rawString.match(/[a-zA-Z_][a-zA-Z0-9_]{2,}/g) || []
  const methodCandidates = words.filter((w) => w !== 'wrap' && w !== 'near' && !w.includes('.near'))
  const method = methodCandidates[0] || null

  let args = {}
  const jsonStartIndex = rawString.indexOf('{')
  const jsonEndIndex = rawString.lastIndexOf('}')

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
    const jsonString = rawString.substring(jsonStartIndex, jsonEndIndex + 1)
    try {
      args = JSON.parse(jsonString)
    } catch (e) {
      console.error('Failed to parse extracted JSON string:', jsonString, e)
    }
  }

  return {
    target,
    method,
    args,
  }
}

export function rlpToNearCallArgs(txBytesB64: string) {
  const decoded = decodeRlpExecuteTransaction(txBytesB64)
  if (decoded === null) {
    return null
  }
  return extractNearAction(decoded)
}

export function getTransactionFunctionCallArgs(
  tx: NearTransaction,
): Array<{ methodName: string; args: any; deposit: string; gas: number }> {
  const actions = tx.actions || []
  const results: Array<{ methodName: string; args: any; deposit: string; gas: number }> = []

  for (const action of actions) {
    if (action && typeof action === 'object' && 'FunctionCall' in action) {
      const fc = action.FunctionCall
      const base64Args = fc.args

      try {
        const jsonString = Buffer.from(base64Args, 'base64').toString('utf-8')
        const parsedArgs = jsonString ? JSON.parse(jsonString) : null

        results.push({
          methodName: fc.method_name,
          args: parsedArgs,
          deposit: fc.deposit,
          gas: fc.gas,
        })
      } catch (_err) {
        results.push({
          methodName: fc.method_name,
          args: Buffer.from(base64Args, 'base64').toString('utf-8'),
          deposit: fc.deposit,
          gas: fc.gas,
        })
      }
    }
  }

  return results
}

export function isNearTransactionSuccess(txResult: NearTxStatus): boolean {
  if (txResult.status && typeof txResult.status === 'object') {
    if ('Failure' in txResult.status) {
      return false
    }
  }

  if (Array.isArray(txResult.receipts_outcome)) {
    for (const receiptWrapper of txResult.receipts_outcome) {
      const outcomeStatus = receiptWrapper.outcome?.status

      if (outcomeStatus && typeof outcomeStatus === 'object') {
        if ('Failure' in outcomeStatus) {
          return false
        }
      }
    }
  }

  return true
}

export function extractTransactions() {
  return (source: Observable<NearBlock>): Observable<NearTransaction> => {
    return source.pipe(
      mergeMap((block) => {
        return block.transactions.map((t) => ({
          ...t,
          blockNumber: block.number,
          blockHash: block.hash,
          timestamp: block.timestamp,
        }))
      }),
    )
  }
}

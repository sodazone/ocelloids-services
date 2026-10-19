import { mergeMap, Observable } from 'rxjs'
import { NearBlock, NearTransaction, NearTxStatus } from './types.js'

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

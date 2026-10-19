import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NearTxStatus } from '@/services/networking/near/types.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const nearDir = resolve(__dirname, '__data__/near')

export function testNearTxStatusFrom(file: string): NearTxStatus {
  const txStatusJson = readFileSync(resolve(nearDir, file), 'utf-8')
  const txStatus = JSON.parse(txStatusJson) as NearTxStatus
  return txStatus
}

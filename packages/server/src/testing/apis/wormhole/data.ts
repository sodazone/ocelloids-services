import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const blocksDir = resolve(__dirname, '../../__data__/whscan')

export function _test_whscanResponse(file: string): WormholeOperation {
  return JSON.parse(readFileSync(resolve(blocksDir, file)).toString())
}

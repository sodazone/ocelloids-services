import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { decodeBlock } from '@/services/ingress/watcher/codec.js'
import { Block, createRuntimeApiContext } from '@/services/networking/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const blocksDir = resolve(__dirname, '__data__/blocks')

export function testApiContextFromMetadata(metadataFile: string) {
  const m = readFileSync(resolve(__dirname, '__data__/metadata', metadataFile))
  return createRuntimeApiContext(m)
}

export function testBlocksFrom(file: string) {
  const bufferBlock = readFileSync(resolve(blocksDir, file))
  return [decodeBlock(bufferBlock)]
}

function testBlocksFromFiles(paths: string[]) {
  const blocks: Block[] = []
  const files = Array.isArray(paths) ? paths : [paths]

  for (const file of files) {
    const bufferBlock = readFileSync(file)
    blocks.push(decodeBlock(bufferBlock))
  }

  return blocks
}

function testBlocksFromDirectory(directory: string, files: string[]) {
  const dir = resolve(blocksDir, directory)
  return testBlocksFromFiles(files.map((f) => resolve(dir, f)))
}

const range = (start: number, end: number) => Array.from({ length: end - start }, (_, k) => k + start)
export const polkadotBlocks = testBlocksFromDirectory(
  'polkadot',
  range(23075458, 23075467).map((n) => n + '.cbor'),
)

export const moonbeamBlocks = () => {
  return testBlocksFromFiles([resolve(blocksDir, 'moonbeam', '8124761.cbor')])
}

export const astarBlocks = () => {
  return testBlocksFromFiles([resolve(blocksDir, 'astar', '7391132.cbor')])
}

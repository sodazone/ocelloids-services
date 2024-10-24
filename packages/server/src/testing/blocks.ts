import { readFileSync, readdirSync } from 'node:fs'
import * as path from 'node:path'
import * as url from 'url'

import { decodeBlock } from '@/services/ingress/watcher/codec.js'
import { Block, createRuntimeApiContext } from '@/services/networking/index.js'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const blocksDir = path.resolve(__dirname, '__data__/blocks')

export function testApiContextFromMetadata(metadataFile: string) {
  const m = readFileSync(path.resolve(__dirname, '__data__/metadata', metadataFile))
  return createRuntimeApiContext(m)
}

export function testBlocksFrom(file: string) {
  const bufferBlock = readFileSync(path.resolve(blocksDir, file))
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

export function testBlocksFromDirectory(directory: string) {
  const dir = path.resolve(blocksDir, directory)
  const files = readdirSync(dir)
  return testBlocksFromFiles(files.map((f) => path.resolve(dir, f)))
}

export const polkadotBlocks = testBlocksFromDirectory('polkadot')

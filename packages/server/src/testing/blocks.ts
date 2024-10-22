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

export function resolveBlocksPath(file: string) {
  return path.resolve(blocksDir, file)
}

export function testBlocksFrom(paths: string[]) {
  const blocks: Block[] = []
  const files = Array.isArray(paths) ? paths : [paths]

  for (const file of files) {
    const bufferBlock = readFileSync(file)
    blocks.push(decodeBlock(bufferBlock))
  }

  return blocks
}

export function testBlocksForDirectory(directory: string) {
  const dir = path.resolve(blocksDir, directory)
  const files = readdirSync(dir)
  return testBlocksFrom(files.map((f) => path.resolve(dir, f)))
}

export const polkadotBlocks = testBlocksForDirectory('polkadot')

//export const polkadotBlocks = testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')
//export const interlayBlocks = testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json')
//export const assetHubBlocks = testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json')

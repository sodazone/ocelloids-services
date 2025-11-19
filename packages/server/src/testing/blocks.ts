import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Abi } from 'viem'

import { decodeEvmBlock } from '@/services/networking/evm/codec.js'
import { BlockWithLogs, Block as EvmBlock } from '@/services/networking/evm/types.js'
import { decodeBlock } from '@/services/networking/substrate/codec.js'
import { Block, createContextFromMetadata } from '@/services/networking/substrate/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const blocksDir = resolve(__dirname, '__data__/blocks')

export function testApiContextFromMetadata(metadataFile: string) {
  const m = readFileSync(resolve(__dirname, '__data__/metadata', metadataFile))
  return createContextFromMetadata(m)
}

export function testEvmBlocksFrom(file: string, withLogs: true): BlockWithLogs[]
export function testEvmBlocksFrom(file: string, withLogs?: false): EvmBlock[]
export function testEvmBlocksFrom(file: string, withLogs = false): BlockWithLogs[] | EvmBlock[] {
  const bufferBlock = readFileSync(resolve(blocksDir, file))
  const decodedBlockWithLogs = decodeEvmBlock(bufferBlock)

  if (withLogs) {
    return [decodedBlockWithLogs]
  }

  const decodedBlock = {
    ...decodedBlockWithLogs,
    logs: undefined,
  }

  return [decodedBlock]
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

const loadAbi = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, `__data__/abis/${name}.json`)).toString()) as Abi

export const moonbeamAbis = () => {
  return {
    prices: loadAbi('price_feed'),
    swap: loadAbi('swap'),
    erc20: loadAbi('erc20'),
  }
}

export const moonbeamBlocks = () => {
  return testBlocksFromDirectory(
    'moonbeam',
    ['8124761', '8238256', '8238763', '8250243'].map((n) => n + '.cbor'),
  )
}

export const moonbeamXcmBlock = () => {
  return testBlocksFromFiles([resolve(blocksDir, 'moonbeam', '9105566.cbor')])
}

export const astarBlocks = () => {
  return testBlocksFromFiles([resolve(blocksDir, 'astar', '7391132.cbor')])
}

export const expectedTxs = {
  astar: [
    [
      '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
      '0x48a8b22bc0fdd902688a17dd1b8c8283af73b90001e44ddf8be10f9d3817dfb9',
    ],
    [
      '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
      '0xe3c6a76e4630844d6c8d4c7695ad6d64dc12a7c419dfa8848e073d8dd72b518b',
    ],
    [
      '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
      '0xb6237783a1aeb5fd49018631f86578dcd8e6062f1a392ac752459fb2a051fa8e',
    ],
    [
      '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
      '0x6124fcd0e0d90dc02a6dfecc9d77b65f1e3e8c7a46d20ffb9346677a724ea787',
    ],
    [
      '0x339d413CCEfD986b1B3647A9cfa9CBbE70A30749',
      '0x377bdf60d223b38bac68789c161c6e755f8db31525f219d15c90696f6b0cd834',
    ],
  ],
  moonbeam: [
    [
      '0x7206ee7BEB0489C688914cCef39f1aa7fa9a988F',
      '0x9d749829ae6abbd2dbe63dc709f4f29a2fc1b95ace7b41948d47fb073300cd27',
    ],
    [
      '0xA84Cd88D678dD59F0b90291EE62BA19665C29CF2',
      '0x7bcc0b1cb509c0dcbb75475dcd75075fb07ec1ac0345d0f33e4cfc7b59710496',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0xc07f0ed95e914c12d106eb570b05db000260e4dda441bf7def77e1067aa0d3bd',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0x7cc8ff44946925d2ce137cd3dfe052f5fcbe28f10124a107c68d85f881614c55',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0xbf4ed6ea156698a5009da7001d6e08e354a0207e1755013e4f69248ab1792128',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0xcdb0c2c778d6913ec4ae0688e9d8a81dea8bb83ebe852074ad41a30511313a55',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0x8410bd726607547e4bac432ba0de8e5185e4d712cdc22f7495c5ddcfc79124da',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0xe5123471b42e2b8d5b4d4e8e7ab2934515ba6eb63df66cf2909cc1fa579c0dae',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0x0079a0fc8f2f0ee400d763dad5d5a3cd8cf4d1aedca5021e0b887bf4c8dc2d7e',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0x7430455bb060f985899ed1b1de9cb3c16cb591d4af8700812475863f832a514b',
    ],
    [
      '0xbaECbdde43C6c6a167c37d5b789023592B27fF93',
      '0xb065c4c97e9442ed8f8ee1dd884130dc9908e54c461156e4d191dde9d008a9d6',
    ],
  ],
}

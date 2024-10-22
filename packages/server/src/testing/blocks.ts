import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import * as url from 'url'

import { decode } from 'cbor-x'

import { Bin, Bytes, Struct, Vector, blockHeader } from '@polkadot-api/substrate-bindings'
import { AccountId } from 'polkadot-api'
import { fromHex } from 'polkadot-api/utils'

import { decodeBlock } from '@/services/ingress/watcher/codec.js'
import { Block, EventRecord, createRuntimeApiContext } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export type BinBlock = {
  block: Uint8Array
  events: Uint8Array[]
  author?: Uint8Array
}

type RpcResult = {
  jsonrpc: string
  id: number
  result: HexString
}

export function testRegistryFromMetadata(metadataFile: string) {
  const m = readFileSync(path.resolve(__dirname, '__data__/metadata', metadataFile))
  return createRuntimeApiContext(m)
}

const accountId = AccountId().dec

export function from(header: Uint8Array, body: Uint8Array, events: Uint8Array[]) {
  const registry = testRegistryFromMetadata('polkadot.json')
  console.log(registry.hasPallet('System'))
  console.log(blockHeader.dec(header))
  console.log(registry.decodeExtrinsic(Vector(Bytes()).dec(body)[0]))
  // console.log(events.map(registry.events.dec))
}

export function testBlocksFrom(file: string, metadataFile: string) {
  const bufferBlock = readFileSync(path.resolve(__dirname, '__data__/blocks', file))
  const blocks: Block = decodeBlock(bufferBlock)

  const registry = testRegistryFromMetadata(metadataFile)

  console.log(JSON.stringify(blocks))

  /*
  return blocks.map((b) => {
    console.log(b.block)
    //const records = registry.events.dec(b.events[0])
    // const author = b.author? accountId(b.author) : undefined
    const rawBlock = Struct({
      header: blockHeader,
      body: Vector(Bin(Infinity)),
    })
    const block = rawBlock.dec(b.block)
    //const records = registry.createType('Vec<EventRecord>', b.events, true)
    //const author = registry.createType('AccountId', b.author)

    return {
      hash: block.header.extrinsicRoot,
      number: block.header.number,
      extrinsics: [],
      events: [],
    } as Block
  })*/
}

//export const polkadotBlocks = testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')
//export const interlayBlocks = testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json')
//export const assetHubBlocks = testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json')

import { decode, encode } from 'cbor-x'

import type { SignedBlockExtended } from '@polkadot/api-derive/types'
import type { Registry } from '@polkadot/types-codec/types'
import type { AccountId, EventRecord } from '@polkadot/types/interfaces'

import { createSignedBlockExtended } from '@polkadot/api-derive'

import { BinBlock } from '../../subscriptions/types.js'

export function decodeSignedBlockExtended(registry: Registry, buffer: Buffer | Uint8Array) {
  const binBlock: BinBlock = decode(buffer)
  const block = registry.createType('SignedBlock', binBlock.block)
  const records = registry.createType('Vec<EventRecord>', binBlock.events, true)
  const author = registry.createType('AccountId', binBlock.author)

  const signedBlock = createSignedBlockExtended(
    registry,
    block as SignedBlockExtended,
    records as unknown as EventRecord[],
    null,
    author as AccountId,
  )

  return signedBlock
}

export function encodeSignedBlockExtended(block: SignedBlockExtended) {
  return encode({
    block: block.toU8a(),
    events: block.events.map((ev) => ev.toU8a()),
    author: block.author?.toU8a(),
  } as BinBlock)
}
